import User from "../models/user.model.js";
import CreditTransaction from "../models/creditTransaction.model.js";
import { normalizePlanId } from "../utils/plan.js";

export const AGENT_COSTS = Object.freeze({
    chat: 3,
    search: 5,
    coding: 10,
    pdf: 10,
    ppt: 10,
    vision: 8,
});

const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const ORDER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function badRequest(res, message) {
    return res.status(400).json({ code: "INVALID_PAYLOAD", message });
}

function isDuplicateKey(error) {
    return error?.code === 11000;
}

/**
 * Claims an idempotency key before any balance change. Returns the existing
 * row when the key was already used, so callers can decide replay semantics.
 */
async function claim(key, data) {
    try {
        const doc = await CreditTransaction.create({ key, status: "pending", ...data });
        return { doc, fresh: true };
    } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        const existing = await CreditTransaction.findOne({ key });
        return { doc: existing, fresh: false };
    }
}

function replayResponse(res, existing, successBody) {
    if (!existing) {
        return res.status(409).json({ code: "IDEMPOTENCY_CONFLICT", message: "Request is already in progress." });
    }
    if (existing.status === "applied") {
        return res.status(200).json({ ...successBody, duplicate: true });
    }
    if (existing.status === "pending") {
        return res.status(409).json({ code: "IDEMPOTENCY_CONFLICT", message: "Request is already in progress." });
    }
    return res.status(409).json({ code: "PREVIOUS_ATTEMPT_FAILED", message: "This request already failed and cannot be replayed." });
}

// ---------------------------------------------------------------------------
// POST /deduct-credits  (agent -> auth, internal token required)
// ---------------------------------------------------------------------------

export const deductCredits = async (req, res) => {
    try {
        const { requestId, userId, agent } = req.body ?? {};

        if (typeof requestId !== "string" || !KEY_PATTERN.test(requestId)) {
            return badRequest(res, "A valid requestId is required.");
        }
        if (typeof userId !== "string" || userId.trim().length === 0) {
            return badRequest(res, "A valid userId is required.");
        }
        if (typeof agent !== "string" || !Object.prototype.hasOwnProperty.call(AGENT_COSTS, agent)) {
            return badRequest(res, "Unknown agent.");
        }

        const cost = AGENT_COSTS[agent];
        const key = `reserve:${requestId}`;

        const { doc, fresh } = await claim(key, {
            userId: userId.trim(),
            type: "reserve",
            credits: cost,
            agent,
        });

        if (!fresh) {
            return replayResponse(res, doc, { success: true, charged: doc?.credits ?? cost });
        }

        // Conditional decrement is the atomicity boundary: two concurrent
        // requests cannot both pass when only one balance is available.
        const user = await User.findOneAndUpdate(
            { firebaseUid: userId.trim(), credits: { $gte: cost } },
            { $inc: { credits: -cost } },
            { new: true }
        );

        if (!user) {
            await CreditTransaction.updateOne(
                { key },
                { $set: { status: "failed", detail: "Insufficient credits." } }
            );
            return res.status(402).json({
                code: "INSUFFICIENT_CREDITS",
                message: "Not enough credits for this request.",
                required: cost,
            });
        }

        await CreditTransaction.updateOne({ key }, { $set: { status: "applied" } });

        return res.status(200).json({
            success: true,
            charged: cost,
            credits: user.credits,
        });
    } catch (error) {
        console.error("[auth] deduct credits failed");
        return res.status(500).json({ code: "DEDUCT_FAILED", message: "Unable to apply credits." });
    }
};

// ---------------------------------------------------------------------------
// POST /refund-credits  (agent -> auth) — compensates a failed generation
// ---------------------------------------------------------------------------

export const refundCredits = async (req, res) => {
    try {
        const { requestId, userId } = req.body ?? {};

        if (typeof requestId !== "string" || !KEY_PATTERN.test(requestId)) {
            return badRequest(res, "A valid requestId is required.");
        }
        if (typeof userId !== "string" || userId.trim().length === 0) {
            return badRequest(res, "A valid userId is required.");
        }

        const reserve = await CreditTransaction.findOne({
            key: `reserve:${requestId}`,
            userId: userId.trim(),
            type: "reserve",
            status: "applied",
        });
        if (!reserve) {
            return res.status(404).json({ code: "RESERVATION_NOT_FOUND", message: "No applied reservation for this request." });
        }

        // The refunded amount is always the recorded reservation, never a
        // client-supplied number.
        const amount = reserve.credits;
        const key = `refund:${requestId}`;

        const { doc, fresh } = await claim(key, {
            userId: userId.trim(),
            type: "refund",
            credits: amount,
            agent: reserve.agent,
        });

        if (!fresh) {
            return replayResponse(res, doc, { success: true, refunded: amount });
        }

        const user = await User.findOneAndUpdate(
            { firebaseUid: userId.trim() },
            { $inc: { credits: amount } },
            { new: true }
        );

        if (!user) {
            await CreditTransaction.updateOne({ key }, { $set: { status: "failed", detail: "User not found." } });
            return res.status(404).json({ code: "USER_NOT_FOUND", message: "User not found." });
        }

        await CreditTransaction.updateOne({ key }, { $set: { status: "applied" } });

        return res.status(200).json({ success: true, refunded: amount, credits: user.credits });
    } catch (error) {
        console.error("[auth] refund credits failed");
        return res.status(500).json({ code: "REFUND_FAILED", message: "Unable to refund credits." });
    }
};

// ---------------------------------------------------------------------------
// POST /update-plan  (billing -> auth) — idempotent credit grant
// ---------------------------------------------------------------------------

export const updateUserPayment = async (req, res) => {
    try {
        const { plan, credits, userId, orderId, planExpiresAt } = req.body ?? {};

        if (typeof userId !== "string" || userId.trim().length === 0) {
            return badRequest(res, "A valid userId is required.");
        }
        if (typeof orderId !== "string" || !ORDER_ID_PATTERN.test(orderId)) {
            return badRequest(res, "A valid orderId is required.");
        }
        if (!Number.isInteger(credits) || credits < 0 || credits > 1_000_000) {
            return badRequest(res, "credits must be a non-negative integer.");
        }
        if (typeof plan !== "string") {
            return badRequest(res, "A valid plan is required.");
        }

        const planId = normalizePlanId(plan);
        const expiry = planExpiresAt ? new Date(planExpiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        if (Number.isNaN(expiry.getTime())) {
            return badRequest(res, "planExpiresAt is invalid.");
        }

        const key = `order:${orderId}`;
        const { doc, fresh } = await claim(key, {
            userId: userId.trim(),
            type: "grant",
            credits,
            orderId,
        });

        if (!fresh) {
            // A retried provider callback must not grant twice.
            return replayResponse(res, doc, {
                success: true,
                userId: userId.trim(),
                plan: planId,
                credits,
            });
        }

        const user = await User.findOneAndUpdate(
            { firebaseUid: userId.trim() },
            {
                $inc: { credits, totalCredits: credits },
                $set: { plan: planId, planExpiresAt: expiry },
            },
            { new: true }
        );

        if (!user) {
            await CreditTransaction.updateOne({ key }, { $set: { status: "failed", detail: "User not found." } });
            return res.status(404).json({ code: "USER_NOT_FOUND", message: "User not found." });
        }

        await CreditTransaction.updateOne({ key }, { $set: { status: "applied" } });

        // `credits` is the amount granted, matching billing's acknowledgement
        // contract; `balance` is the resulting account balance.
        return res.status(200).json({
            success: true,
            userId: user.firebaseUid,
            plan: planId,
            credits,
            balance: user.credits,
        });
    } catch (error) {
        console.error("[auth] update plan failed");
        return res.status(500).json({ code: "UPDATE_PLAN_FAILED", message: "Unable to update the plan." });
    }
};

// ---------------------------------------------------------------------------
// POST /revoke-credits  (billing -> auth) — clawback on refund
// ---------------------------------------------------------------------------

export const revokeCredits = async (req, res) => {
    try {
        const { userId, credits, refundAttemptId, downgrade } = req.body ?? {};

        if (typeof userId !== "string" || userId.trim().length === 0) {
            return badRequest(res, "A valid userId is required.");
        }
        if (!Number.isInteger(credits) || credits < 0 || credits > 1_000_000) {
            return badRequest(res, "credits must be a non-negative integer.");
        }
        if (typeof refundAttemptId !== "string" || !KEY_PATTERN.test(refundAttemptId)) {
            return badRequest(res, "A valid refundAttemptId is required.");
        }

        const key = `revoke:${refundAttemptId}`;
        const { doc, fresh } = await claim(key, {
            userId: userId.trim(),
            type: "revoke",
            credits,
            refundAttemptId,
        });

        if (!fresh) {
            return replayResponse(res, doc, { success: true, revoked: credits });
        }

        const update = { $inc: { credits: -credits, totalCredits: -credits } };
        if (downgrade === true) {
            update.$set = { plan: "free", planExpiresAt: null };
        }

        const user = await User.findOneAndUpdate(
            { firebaseUid: userId.trim(), credits: { $gte: credits } },
            update,
            { new: true }
        );

        if (!user) {
            // Credits already spent: the refund must be refused, not granted
            // for free.
            await CreditTransaction.updateOne(
                { key },
                { $set: { status: "failed", detail: "Credits already spent." } }
            );
            return res.status(409).json({
                code: "CREDITS_SPENT",
                message: "Credits from this order have already been used, so it cannot be refunded.",
            });
        }

        await CreditTransaction.updateOne({ key }, { $set: { status: "applied" } });

        return res.status(200).json({ success: true, revoked: credits, credits: user.credits });
    } catch (error) {
        console.error("[auth] revoke credits failed");
        return res.status(500).json({ code: "REVOKE_FAILED", message: "Unable to revoke credits." });
    }
};

// ---------------------------------------------------------------------------
// POST /restore-credits  (billing -> auth) — compensation if the provider
// refund fails after the clawback succeeded
// ---------------------------------------------------------------------------

export const restoreCredits = async (req, res) => {
    try {
        const { userId, credits, refundAttemptId } = req.body ?? {};

        if (typeof userId !== "string" || userId.trim().length === 0) {
            return badRequest(res, "A valid userId is required.");
        }
        if (!Number.isInteger(credits) || credits < 0 || credits > 1_000_000) {
            return badRequest(res, "credits must be a non-negative integer.");
        }
        if (typeof refundAttemptId !== "string" || !KEY_PATTERN.test(refundAttemptId)) {
            return badRequest(res, "A valid refundAttemptId is required.");
        }

        const key = `restore:${refundAttemptId}`;
        const { doc, fresh } = await claim(key, {
            userId: userId.trim(),
            type: "restore",
            credits,
            refundAttemptId,
        });

        if (!fresh) {
            return replayResponse(res, doc, { success: true, restored: credits });
        }

        const user = await User.findOneAndUpdate(
            { firebaseUid: userId.trim() },
            { $inc: { credits, totalCredits: credits } },
            { new: true }
        );

        if (!user) {
            await CreditTransaction.updateOne({ key }, { $set: { status: "failed", detail: "User not found." } });
            return res.status(404).json({ code: "USER_NOT_FOUND", message: "User not found." });
        }

        await CreditTransaction.updateOne({ key }, { $set: { status: "applied" } });

        return res.status(200).json({ success: true, restored: credits, credits: user.credits });
    } catch (error) {
        console.error("[auth] restore credits failed");
        return res.status(500).json({ code: "RESTORE_FAILED", message: "Unable to restore credits." });
    }
};
