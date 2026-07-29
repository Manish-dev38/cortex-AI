import crypto from "node:crypto";
import axios from "axios";
import { PLANS, PLAN_IDS, pricePlan, calculateProration, MIN_CHARGEABLE_PAISA } from "../config/Plans.js";
import { config } from "../config/env.js";
import razorpay from "../config/razorpay.js";
import Payment from "../models/payment.model.js";
import WebhookEvent from "../models/webhookEvent.model.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const CLAIMABLE_STATUSES = ["created", "failed"];
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function timingSafeEqualHex(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || b.length === 0) return false;
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function normalizePlan(raw) {
    if (typeof raw !== "string") return null;
    const value = raw.trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(PLANS, value)) return null;
    if (!PLAN_IDS.includes(value)) return null;
    return value;
}

function sanitizeIdempotencyKey(raw) {
    if (raw === undefined || raw === null) return null;
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (typeof header !== "string" || header.trim().length === 0) return null;
    const value = header.trim();
    if (!IDEMPOTENCY_KEY_PATTERN.test(value)) return { error: "INVALID_IDEMPOTENCY_KEY" };
    return { value };
}

function newReceipt() {
    return `rcpt_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function newInvoiceId() {
    return `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function sanitizePayment(payment) {
    if (!payment) return null;
    const obj = typeof payment.toObject === "function" ? payment.toObject() : payment;
    return {
        orderId: obj.orderId,
        paymentId: obj.paymentId,
        userId: obj.userId,
        plan: obj.plan,
        credits: obj.credits,
        totalCredits: obj.totalCredits,
        pricing: {
            subtotal: obj.amountSubtotal,
            discount: obj.discountAmount,
            proratedCredit: obj.proratedCredit,
            tax: obj.taxAmount,
            total: obj.amountTotal,
            currency: obj.currency,
        },
        amountPaise: obj.amountPaise,
        currency: obj.currency,
        status: obj.status,
        creditStatus: obj.creditStatus,
        invoiceId: obj.invoiceId,
        invoice: obj.invoice
            ? {
                id: obj.invoice.id,
                subtotal: obj.invoice.subtotal,
                discount: obj.invoice.discount,
                proratedCredit: obj.invoice.proratedCredit,
                tax: obj.invoice.tax,
                total: obj.invoice.total,
                currency: obj.invoice.currency,
                issuedAt: obj.invoice.issuedAt,
            }
            : null,
        planExpiresAt: obj.planExpiresAt,
        verifiedAt: obj.verifiedAt,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
    };
}

function publicError(res, status, code, message, extra = {}) {
    return res.status(status).json({ code, message, ...extra });
}

// The downstream credit is only trusted on an explicit positive
// acknowledgement. Any echo of user/plan/credits must match what was sent;
// anything else (missing shape, success:false, mismatched echo) is a failure
// and is retried, never assumed applied.
function downstreamAckMatches(data, payload) {
    if (!data || typeof data !== "object") return false;
    if (data.success === false) return false;
    const echoUser = data.userId ?? data.firebaseUid ?? data.user?.firebaseUid;
    if (echoUser !== undefined && String(echoUser) !== String(payload.userId)) return false;
    if (data.plan !== undefined && String(data.plan) !== String(payload.plan)) return false;
    if (data.credits !== undefined && Number(data.credits) !== Number(payload.credits)) return false;
    return data.success === true;
}

async function creditAuthService(payment) {
    if (typeof payment.userId !== "string" || payment.userId.length === 0) return { ok: false };
    if (!PLAN_IDS.includes(payment.plan)) return { ok: false };
    if (!Number.isInteger(payment.credits) || payment.credits < 0) return { ok: false };
    if (typeof payment.orderId !== "string" || typeof payment.paymentId !== "string") return { ok: false };
    const payload = {
        userId: payment.userId,
        plan: payment.plan,
        credits: payment.credits,
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        invoiceId: payment.invoiceId,
    };
    const headers = {};
    if (config.internalToken) headers["x-service-token"] = config.internalToken;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const response = await axios.post(`${config.authService}/update-plan`, payload, {
                timeout: config.authServiceTimeoutMs,
                headers,
            });
            if (!downstreamAckMatches(response?.data, payload)) {
                throw new Error("Downstream acknowledgement missing or mismatched");
            }
            return { ok: true };
        } catch (error) {
            const status = error?.response?.status;
            // Do not retry caller errors or unknown-user rejections.
            if (status === 400 || status === 401 || status === 403 || status === 404) break;
            if (attempt < 2) {
                await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
            }
        }
    }
    console.error("[billing] downstream credit propagation failed");
    return { ok: false };
}

async function ensureCreditApplied(payment) {
    // Single-flight claim so concurrent verify/webhook workers cannot each
    // propagate the same credit downstream.
    const claimed = await Payment.findOneAndUpdate(
        { orderId: payment.orderId, status: "paid", creditStatus: { $in: ["pending", "failed"] } },
        { $set: { creditStatus: "crediting" } },
        { new: true }
    );
    if (!claimed) {
        const current = await Payment.findOne({ orderId: payment.orderId });
        if (current?.creditStatus === "applied") return { ok: true, already: true };
        if (current?.creditStatus === "crediting") {
            for (let i = 0; i < 10; i += 1) {
                await new Promise((r) => setTimeout(r, 300));
                const polled = await Payment.findOne({ orderId: payment.orderId });
                if (polled?.creditStatus === "applied") return { ok: true, already: true };
                if (polled?.creditStatus !== "crediting") break;
            }
            const after = await Payment.findOne({ orderId: payment.orderId });
            return { ok: after?.creditStatus === "applied" };
        }
        return { ok: false };
    }
    const result = await creditAuthService(claimed);
    await Payment.updateOne(
        { orderId: claimed.orderId },
        { $set: { creditStatus: result.ok ? "applied" : "failed" } }
    );
    return result;
}

async function assignInvoiceIfMissing(orderId, pricing, validityDays) {
    const invoiceId = newInvoiceId();
    const now = new Date();
    const updated = await Payment.findOneAndUpdate(
        { orderId, invoiceId: null },
        {
            $set: {
                invoiceId,
                invoice: {
                    id: invoiceId,
                    subtotal: pricing.subtotal,
                    discount: pricing.discount,
                    proratedCredit: pricing.proratedCredit,
                    tax: pricing.tax,
                    total: pricing.total,
                    currency: pricing.currency,
                    issuedAt: now,
                },
                planExpiresAt: new Date(now.getTime() + validityDays * MS_PER_DAY),
                verifiedAt: now,
            },
        },
        { new: true }
    );
    if (updated) return updated;
    return Payment.findOne({ orderId });
}

// ---------------------------------------------------------------------------
// POST /create
// ---------------------------------------------------------------------------

export const createOrder = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return publicError(res, 401, "MISSING_USER", "Authenticated user identity is required.");
        }

        const planId = normalizePlan(req.body?.plan);
        if (!planId) {
            return publicError(res, 400, "INVALID_PLAN", "Unknown plan. Expected one of: free, starter, pro.");
        }
        const selectedPlan = PLANS[planId];

        const discountCodeRaw = req.body?.discountCode;
        let discountCode = null;
        if (discountCodeRaw !== undefined && discountCodeRaw !== null && String(discountCodeRaw).trim() !== "") {
            if (typeof discountCodeRaw !== "string") {
                return publicError(res, 400, "INVALID_DISCOUNT_CODE", "Discount code must be a string.");
            }
            discountCode = discountCodeRaw.trim().toUpperCase();
        }

        let proratedCredit = 0;
        if (req.body?.proration !== undefined && req.body?.proration !== null) {
            const { currentPlanId, daysRemaining } = req.body.proration;
            const from = normalizePlan(currentPlanId);
            if (!from) {
                return publicError(res, 400, "INVALID_PRORATION", "Proration current plan is invalid.");
            }
            const days = Number(daysRemaining);
            if (!Number.isFinite(days) || days < 0 || days > PLANS[from].validity) {
                return publicError(res, 400, "INVALID_PRORATION", "Proration days remaining is out of range.");
            }
            proratedCredit = calculateProration({ currentPlanId: from, newPlanId: planId, daysRemaining: days }).proratedCredit;
        }

        const pricing = pricePlan(planId, { discountCode, proratedCredit, taxRate: config.taxRateGst });
        if (!pricing) {
            return publicError(res, 400, "INVALID_PLAN", "Unknown plan.");
        }
        if (pricing.error === "UNKNOWN_DISCOUNT_CODE") {
            return publicError(res, 400, "UNKNOWN_DISCOUNT_CODE", "Discount code is not recognised.");
        }

        // Zero-value plans never touch the provider; there is nothing to charge.
        if (pricing.amountPaise < MIN_CHARGEABLE_PAISA) {
            return publicError(res, 400, "FREE_PLAN_NO_PROVIDER_ORDER", "This plan requires no payment and cannot be ordered here.", {
                plan: planId,
                credits: selectedPlan.credits,
            });
        }

        const keyResult = sanitizeIdempotencyKey(req.headers["x-idempotency-key"]);
        if (keyResult?.error) {
            return publicError(res, 400, keyResult.error, "Idempotency key must match [A-Za-z0-9_-]{1,64}.");
        }
        const idempotencyKey = keyResult?.value ?? null;

        if (idempotencyKey) {
            const existing = await Payment.findOne({ userId, idempotencyKey });
            if (existing) {
                return res.status(200).json({
                    message: "Order already exists for this idempotency key.",
                    idempotentReplay: true,
                    payment: sanitizePayment(existing),
                    order: { id: existing.orderId, amount: existing.amountPaise, currency: existing.currency, receipt: existing.receipt },
                });
            }
        }

        // All validation is complete before the provider call, so a provider
        // order is never created for a request we would reject locally.
        let order;
        try {
            order = await razorpay.orders.create({
                amount: pricing.amountPaise,
                currency: pricing.currency,
                receipt: newReceipt(),
                notes: { userId, plan: planId },
            });
        } catch (error) {
            console.error("[billing] provider order request failed");
            return publicError(res, 502, "PROVIDER_ERROR", "Payment provider unavailable. Retry later.");
        }

        if (!order?.id || order.currency !== pricing.currency || Number(order.amount) !== pricing.amountPaise) {
            console.error("[billing] provider order consistency check failed");
            return publicError(res, 502, "PROVIDER_ERROR", "Payment provider returned an inconsistent order.");
        }

        const now = new Date();
        let payment;
        try {
            payment = await Payment.create({
                userId,
                orderId: order.id,
                receipt: order.receipt,
                idempotencyKey,
                plan: selectedPlan.id,
                credits: selectedPlan.credits,
                totalCredits: selectedPlan.credits,
                amountSubtotal: pricing.subtotal,
                discountAmount: pricing.discount,
                proratedCredit: pricing.proratedCredit,
                taxAmount: pricing.tax,
                amountTotal: pricing.total,
                amountPaise: pricing.amountPaise,
                currency: pricing.currency,
                status: "created",
                creditStatus: "pending",
                planExpiresAt: new Date(now.getTime() + selectedPlan.validity * MS_PER_DAY),
                expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
            });
        } catch (error) {
            if (error?.code === 11000) {
                const existing = await Payment.findOne({
                    $or: [{ orderId: order.id }, ...(idempotencyKey ? [{ userId, idempotencyKey }] : [])],
                });
                if (existing) {
                    return res.status(200).json({
                        message: "Order already exists for this idempotency key.",
                        idempotentReplay: true,
                        payment: sanitizePayment(existing),
                        order: { id: existing.orderId, amount: existing.amountPaise, currency: existing.currency, receipt: existing.receipt },
                    });
                }
            }
            // Provider order exists without a local record. The provider
            // reference is returned to the authenticated owner for support
            // reconciliation; server logs carry no identifiers.
            console.error("[billing] order record write failed");
            return publicError(res, 500, "ORDER_RECORD_FAILED", "Order created but could not be recorded. Contact support.", {
                providerOrderId: order.id,
            });
        }

        return res.status(201).json({
            message: "Order created.",
            payment: sanitizePayment(payment),
            order: { id: order.id, amount: order.amount, currency: order.currency, receipt: order.receipt },
        });
    } catch (error) {
        console.error("[billing] create order failed");
        return publicError(res, 500, "CREATE_ORDER_FAILED", "Unable to create order. Retry later.");
    }
};

// ---------------------------------------------------------------------------
// POST /verify
// ---------------------------------------------------------------------------

export const verifyPayment = async (req, res) => {
    try {
        const callerUserId = req.userId;
        if (!callerUserId) {
            return publicError(res, 401, "MISSING_USER", "Authenticated user identity is required.");
        }

        const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body ?? {};
        const fields = { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature };
        const badField = Object.entries(fields).find(
            ([, v]) => typeof v !== "string" || v.trim().length === 0 || v.length > 256
        );
        if (badField) {
            return publicError(res, 400, "INVALID_PAYLOAD", `Field '${badField[0]}' is required as a non-empty string.`);
        }

        const expected = crypto
            .createHmac("sha256", config.razorKeySecret)
            .update(`${orderId}|${paymentId}`)
            .digest("hex");
        if (!timingSafeEqualHex(expected, signature)) {
            return publicError(res, 400, "SIGNATURE_MISMATCH", "Payment signature verification failed.");
        }

        const payment = await Payment.findOne({ orderId });
        if (!payment) {
            return publicError(res, 404, "PAYMENT_NOT_FOUND", "No billing record matches this order.");
        }
        if (payment.userId !== callerUserId) {
            return publicError(res, 403, "FORBIDDEN", "This order belongs to a different user.");
        }

        // Reconcile against the provider before mutating local state: the
        // signature alone does not prove capture, amount, or currency.
        let providerPayment;
        try {
            providerPayment = await razorpay.payments.fetch(paymentId);
        } catch (error) {
            console.error("[billing] provider confirmation request failed");
            return publicError(res, 502, "PROVIDER_ERROR", "Unable to confirm payment with provider. Retry later.");
        }

        if (providerPayment?.order_id !== orderId) {
            await Payment.updateOne({ orderId }, { $set: { status: "failed", failureReason: "Provider order mismatch." } });
            return publicError(res, 409, "ORDER_MISMATCH", "Provider payment does not belong to this order.");
        }
        if (providerPayment?.currency !== payment.currency) {
            await Payment.updateOne({ orderId }, { $set: { status: "failed", failureReason: "Currency mismatch." } });
            return publicError(res, 409, "CURRENCY_MISMATCH", "Provider currency does not match the order.");
        }
        if (Number(providerPayment?.amount) < payment.amountPaise) {
            await Payment.updateOne({ orderId }, { $set: { status: "failed", failureReason: "Captured amount below order total." } });
            return publicError(res, 402, "AMOUNT_MISMATCH", "Captured amount is below the order total.");
        }
        if (providerPayment?.status !== "captured") {
            await Payment.updateOne(
                { orderId },
                { $set: { status: "failed", failureReason: `Provider status: ${providerPayment?.status ?? "unknown"}.` } }
            );
            return publicError(res, 402, "NOT_CAPTURED", "Payment is not captured yet.");
        }

        // Atomic claim: only one concurrent verify can move created/failed
        // to paid, which is what makes double-credit impossible.
        const claimed = await Payment.findOneAndUpdate(
            { orderId, status: { $in: CLAIMABLE_STATUSES } },
            { $set: { status: "paid", paymentId }, $unset: { expiresAt: "" } },
            { new: true }
        );

        if (!claimed) {
            const current = await Payment.findOne({ orderId });
            if (current?.status === "paid" && current.paymentId === paymentId) {
                const credit = await ensureCreditApplied(current);
                const refreshed = await Payment.findOne({ orderId });
                if (credit.ok) {
                    return res.status(200).json({ message: "Payment already verified.", verified: true, alreadyVerified: true, payment: sanitizePayment(refreshed) });
                }
                return res.status(202).json({
                    code: "CREDIT_PENDING",
                    message: "Payment verified; credit propagation pending. Retry verification.",
                    verified: true,
                    alreadyVerified: true,
                    payment: sanitizePayment(refreshed),
                });
            }
            if (current?.status === "paid") {
                return publicError(res, 409, "PAYMENT_CONFLICT", "Order is already paid with a different payment id.");
            }
            return publicError(res, 409, "INVALID_STATE", "Order cannot transition to paid from its current state.", {
                status: current?.status ?? null,
            });
        }

        const validityDays = PLANS[claimed.plan]?.validity ?? 30;
        const settled = await assignInvoiceIfMissing(orderId, {
            subtotal: claimed.amountSubtotal,
            discount: claimed.discountAmount,
            proratedCredit: claimed.proratedCredit,
            tax: claimed.taxAmount,
            total: claimed.amountTotal,
            currency: claimed.currency,
        }, validityDays);

        const credit = await ensureCreditApplied(settled ?? claimed);
        const refreshed = await Payment.findOne({ orderId });
        if (credit.ok) {
            return res.status(200).json({ message: "Payment verified.", verified: true, payment: sanitizePayment(refreshed) });
        }
        // Paid but credit still pending: report 202 (retryable) instead of an
        // error, and every repeat verify retries the credit exactly once.
        return res.status(202).json({
            code: "CREDIT_PENDING",
            message: "Payment verified; credit propagation pending. Retry verification.",
            verified: true,
            payment: sanitizePayment(refreshed),
        });
    } catch (error) {
        console.error("[billing] verify failed");
        return publicError(res, 500, "VERIFY_FAILED", "Unable to verify payment. Retry later.");
    }
};

// ---------------------------------------------------------------------------
// POST /webhook (provider-authenticated; no session required)
// ---------------------------------------------------------------------------

function rawBodyBuffer(req) {
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
    if (typeof req.rawBody === "string") return Buffer.from(req.rawBody);
    try {
        return Buffer.from(JSON.stringify(req.body ?? {}));
    } catch {
        return Buffer.from("");
    }
}

export const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        if (typeof signature !== "string" || signature.length === 0) {
            return publicError(res, 400, "MISSING_SIGNATURE", "Webhook signature is required.");
        }
        const raw = rawBodyBuffer(req);
        const expected = crypto.createHmac("sha256", config.razorWebhookSecret).update(raw).digest("hex");
        if (!timingSafeEqualHex(expected, signature)) {
            return publicError(res, 400, "SIGNATURE_MISMATCH", "Webhook signature verification failed.");
        }

        let event;
        try {
            event = JSON.parse(raw.toString("utf8"));
        } catch {
            return publicError(res, 400, "INVALID_PAYLOAD", "Webhook body is not valid JSON.");
        }

        const type = typeof event?.event === "string" ? event.event : "unknown";
        const entity = event?.payload?.payment?.entity ?? event?.payload?.refund?.entity ?? event?.payload?.dispute?.entity ?? {};
        const entityPaymentId = typeof entity?.id === "string" ? entity.id : null;
        const entityOrderId = typeof entity?.order_id === "string" ? entity.order_id : null;
        const createdAt = event?.created_at ?? event?.createdAt ?? "";
        const eventId = typeof event?.id === "string" && event.id.length > 0
            ? event.id
            : `${type}:${entityPaymentId ?? "none"}:${entityOrderId ?? "none"}:${createdAt}`;

        try {
            await WebhookEvent.create({ eventId, type, orderId: entityOrderId, paymentId: entityPaymentId, status: "processed" });
        } catch (error) {
            if (error?.code === 11000) {
                return res.status(200).json({ received: true, duplicate: true });
            }
            throw error;
        }

        const failRecord = async (orderId, reason) => {
            if (!orderId) return;
            await Payment.updateOne(
                { orderId, status: { $in: CLAIMABLE_STATUSES } },
                { $set: { status: "failed", failureReason: reason.slice(0, 500) } }
            );
        };

        if (type === "payment.captured" || type === "order.paid") {
            if (!entityOrderId || !entityPaymentId) {
                await WebhookEvent.updateOne({ eventId }, { $set: { status: "ignored", detail: "Missing order/payment reference." } });
                return res.status(200).json({ received: true, ignored: true });
            }
            const payment = await Payment.findOne({ orderId: entityOrderId });
            if (!payment) {
                // Browser-closed-before-verify race: keep the event and let the
                // later verify call complete the credit idempotently.
                await WebhookEvent.updateOne({ eventId }, { $set: { status: "deferred", detail: "No local order yet." } });
                return res.status(200).json({ received: true, deferred: true });
            }
            const claimed = await Payment.findOneAndUpdate(
                { orderId: entityOrderId, status: { $in: CLAIMABLE_STATUSES } },
                { $set: { status: "paid", paymentId: entityPaymentId }, $unset: { expiresAt: "" } },
                { new: true }
            );
            const settled = claimed ?? payment;
            if (settled.status === "paid") {
                const validityDays = PLANS[settled.plan]?.validity ?? 30;
                await assignInvoiceIfMissing(entityOrderId, {
                    subtotal: settled.amountSubtotal,
                    discount: settled.discountAmount,
                    proratedCredit: settled.proratedCredit,
                    tax: settled.taxAmount,
                    total: settled.amountTotal,
                    currency: settled.currency,
                }, validityDays);
                await ensureCreditApplied(settled);
                await Payment.updateOne({ orderId: entityOrderId }, { $addToSet: { webhookEventIds: eventId } });
            }
            return res.status(200).json({ received: true });
        }

        if (type === "payment.failed") {
            await failRecord(entityOrderId, `Provider reported failure (${entity?.error_description ?? "payment failed"}).`);
            return res.status(200).json({ received: true });
        }

        if (type.startsWith("refund.")) {
            if (entityOrderId) {
                const refundPaise = Number(entity?.amount) || 0;
                const payment = await Payment.findOne({ orderId: entityOrderId });
                if (payment) {
                    const refundRupees = refundPaise / 100;
                    const fully = refundRupees + (payment.refundAmount || 0) >= (payment.amountTotal || 0);
                    await Payment.updateOne(
                        { orderId: entityOrderId },
                        {
                            $set: {
                                status: fully ? "refunded" : "partially_refunded",
                                refundId: typeof entity?.id === "string" ? entity.id : payment.refundId,
                                refundAmount: (payment.refundAmount || 0) + refundRupees,
                            },
                            $addToSet: { webhookEventIds: eventId },
                        }
                    );
                }
            }
            return res.status(200).json({ received: true });
        }

        if (type.startsWith("dispute.") || type === "payment.disputed") {
            if (entityOrderId) {
                await Payment.updateOne(
                    { orderId: entityOrderId },
                    {
                        $set: { status: "disputed", disputeId: entityPaymentId },
                        $addToSet: { webhookEventIds: eventId },
                    }
                );
            }
            return res.status(200).json({ received: true });
        }

        await WebhookEvent.updateOne({ eventId }, { $set: { status: "ignored", detail: `Unhandled event ${type}.` } });
        return res.status(200).json({ received: true, ignored: true });
    } catch (error) {
        console.error("[billing] webhook failed");
        return publicError(res, 500, "WEBHOOK_FAILED", "Webhook could not be processed.");
    }
};

// ---------------------------------------------------------------------------
// POST /refund
// ---------------------------------------------------------------------------

export const requestRefund = async (req, res) => {
    try {
        const callerUserId = req.userId;
        if (!callerUserId) {
            return publicError(res, 401, "MISSING_USER", "Authenticated user identity is required.");
        }
        const { orderId, amount, reason } = req.body ?? {};
        if (typeof orderId !== "string" || orderId.trim().length === 0) {
            return publicError(res, 400, "INVALID_PAYLOAD", "Field 'orderId' is required as a non-empty string.");
        }
        let refundRupees = null;
        if (amount !== undefined && amount !== null) {
            refundRupees = Number(amount);
            if (!Number.isFinite(refundRupees) || refundRupees <= 0) {
                return publicError(res, 400, "INVALID_PAYLOAD", "Refund amount must be a positive number.");
            }
        }

        const payment = await Payment.findOne({ orderId });
        if (!payment) {
            return publicError(res, 404, "PAYMENT_NOT_FOUND", "No billing record matches this order.");
        }
        if (payment.userId !== callerUserId) {
            return publicError(res, 403, "FORBIDDEN", "This order belongs to a different user.");
        }
        if (!["paid", "partially_refunded"].includes(payment.status)) {
            return publicError(res, 409, "INVALID_STATE", "Only settled payments can be refunded.", { status: payment.status });
        }
        if (!payment.paymentId) {
            return publicError(res, 409, "INVALID_STATE", "No captured provider payment to refund.");
        }

        const remaining = Math.max(0, (payment.amountTotal || 0) - (payment.refundAmount || 0));
        const target = refundRupees ?? remaining;
        if (target <= 0 || target > remaining) {
            return publicError(res, 400, "REFUND_EXCEEDS_TOTAL", "Refund amount exceeds the refundable total.", { refundable: remaining });
        }

        let refund;
        try {
            refund = await razorpay.payments.refund(payment.paymentId, {
                amount: Math.round(target * 100),
                notes: { orderId, reason: typeof reason === "string" ? reason.slice(0, 200) : "customer_request" },
            });
        } catch (error) {
            console.error("[billing] refund provider request failed");
            return publicError(res, 502, "PROVIDER_ERROR", "Refund provider unavailable. Retry later.");
        }

        const newRefundTotal = (payment.refundAmount || 0) + target;
        const fully = newRefundTotal >= (payment.amountTotal || 0);
        const updated = await Payment.findOneAndUpdate(
            { orderId },
            {
                $set: {
                    status: fully ? "refunded" : "partially_refunded",
                    refundId: refund?.id ?? payment.refundId,
                    refundAmount: newRefundTotal,
                },
            },
            { new: true }
        );
        return res.status(200).json({ refunded: true, payment: sanitizePayment(updated) });
    } catch (error) {
        console.error("[billing] refund failed");
        return publicError(res, 500, "REFUND_FAILED", "Unable to process refund. Retry later.");
    }
};

// ---------------------------------------------------------------------------
// POST /cancel + GET /payments/:orderId
// ---------------------------------------------------------------------------

export const cancelSubscription = async (req, res) => {
    try {
        const callerUserId = req.userId;
        if (!callerUserId) {
            return publicError(res, 401, "MISSING_USER", "Authenticated user identity is required.");
        }
        const { orderId } = req.body ?? {};
        const query = orderId
            ? { orderId, userId: callerUserId }
            : { userId: callerUserId, status: { $in: ["paid", "partially_refunded"] } };
        const payment = await Payment.findOne(query, null, { sort: { createdAt: -1 } });
        if (!payment) {
            return publicError(res, 404, "PAYMENT_NOT_FOUND", "No active subscription found.");
        }
        if (payment.userId !== callerUserId) {
            return publicError(res, 403, "FORBIDDEN", "This order belongs to a different user.");
        }
        if (!["paid", "partially_refunded"].includes(payment.status)) {
            return publicError(res, 409, "INVALID_STATE", "Only active subscriptions can be cancelled.", { status: payment.status });
        }
        const updated = await Payment.findOneAndUpdate(
            { orderId: payment.orderId, status: payment.status },
            { $set: { status: "cancelled", cancelledAt: new Date() } },
            { new: true }
        );
        return res.status(200).json({
            cancelled: true,
            note: "Future renewals stop. Already-granted credits are retained under the additive credit model.",
            payment: sanitizePayment(updated),
        });
    } catch (error) {
        console.error("[billing] cancel failed");
        return publicError(res, 500, "CANCEL_FAILED", "Unable to cancel subscription. Retry later.");
    }
};

export const getPayment = async (req, res) => {
    try {
        const callerUserId = req.userId;
        if (!callerUserId) {
            return publicError(res, 401, "MISSING_USER", "Authenticated user identity is required.");
        }
        const orderId = req.params?.orderId;
        if (typeof orderId !== "string" || orderId.trim().length === 0) {
            return publicError(res, 400, "INVALID_PAYLOAD", "Order id path parameter is required.");
        }
        const payment = await Payment.findOne({ orderId });
        if (!payment) {
            return publicError(res, 404, "PAYMENT_NOT_FOUND", "No billing record matches this order.");
        }
        if (payment.userId !== callerUserId) {
            return publicError(res, 403, "FORBIDDEN", "This order belongs to a different user.");
        }
        return res.status(200).json({ payment: sanitizePayment(payment) });
    } catch (error) {
        console.error("[billing] lookup failed");
        return publicError(res, 500, "LOOKUP_FAILED", "Unable to fetch payment. Retry later.");
    }
};
