import test from "node:test";
import assert from "node:assert/strict";
import { pricePlan, PLANS, PLAN_IDS, MIN_CHARGEABLE_PAISA } from "../config/Plans.js";
import { creditsToRevokeForRefund, isFullyRefunded } from "../utils/refund.js";

test("plan catalogue", async (t) => {
    await t.test("uses lowercase ids", () => {
        assert.deepEqual([...PLAN_IDS].sort(), ["free", "pro", "starter"]);
        for (const id of PLAN_IDS) assert.equal(PLANS[id].id, id);
    });

    await t.test("free plan has no chargeable amount", () => {
        const pricing = pricePlan("free", { taxRate: 0.18 });
        assert.equal(pricing.amountPaise, 0);
        assert.ok(pricing.amountPaise < MIN_CHARGEABLE_PAISA);
    });
});

test("pricePlan", async (t) => {
    await t.test("prices the starter plan with 18% tax", () => {
        const pricing = pricePlan("starter", { taxRate: 0.18 });
        assert.equal(pricing.subtotal, 199);
        assert.equal(pricing.discount, 0);
        assert.equal(pricing.tax, 36);
        assert.equal(pricing.total, 235);
        assert.equal(pricing.amountPaise, 23500);
        assert.equal(pricing.currency, "INR");
    });

    await t.test("applies a known discount code", () => {
        const pricing = pricePlan("pro", { discountCode: "WELCOME10", taxRate: 0.18 });
        assert.equal(pricing.subtotal, 499);
        assert.equal(pricing.discount, 49);
        assert.equal(pricing.taxable, 450);
        assert.equal(pricing.tax, 81);
        assert.equal(pricing.total, 531);
    });

    await t.test("rejects an unknown discount code instead of silently charging full price", () => {
        assert.deepEqual(pricePlan("pro", { discountCode: "NOPE" }), { error: "UNKNOWN_DISCOUNT_CODE" });
    });

    await t.test("clamps proration to the payable subtotal", () => {
        const pricing = pricePlan("starter", { proratedCredit: 10_000, taxRate: 0.18 });
        assert.equal(pricing.proratedCredit, 199);
        assert.equal(pricing.taxable, 0);
        assert.equal(pricing.amountPaise, 0);
    });

    await t.test("ignores negative proration", () => {
        const pricing = pricePlan("starter", { proratedCredit: -500, taxRate: 0.18 });
        assert.equal(pricing.proratedCredit, 0);
        assert.equal(pricing.amountPaise, 23500);
    });

    await t.test("returns null for an unknown plan", () => {
        assert.equal(pricePlan("enterprise"), null);
    });
});

test("creditsToRevokeForRefund", async (t) => {
    await t.test("full refund revokes every granted credit", () => {
        assert.equal(creditsToRevokeForRefund({ credits: 500, amountTotal: 235, refundAmount: 235 }), 500);
    });

    await t.test("partial refund revokes the proportional share", () => {
        assert.equal(creditsToRevokeForRefund({ credits: 500, amountTotal: 200, refundAmount: 100 }), 250);
    });

    await t.test("never revokes more than the order granted", () => {
        assert.equal(creditsToRevokeForRefund({ credits: 100, amountTotal: 200, refundAmount: 500 }), 100);
    });

    await t.test("returns zero when nothing is refundable", () => {
        assert.equal(creditsToRevokeForRefund({ credits: 0, amountTotal: 200, refundAmount: 100 }), 0);
        assert.equal(creditsToRevokeForRefund({ credits: 100, amountTotal: 0, refundAmount: 0 }), 0);
        assert.equal(creditsToRevokeForRefund({ credits: 100, amountTotal: 200, refundAmount: -1 }), 0);
    });
});

test("isFullyRefunded", async (t) => {
    await t.test("detects a full refund", () => {
        assert.equal(isFullyRefunded({ refundAmount: 235, amountTotal: 235 }), true);
        assert.equal(isFullyRefunded({ refundAmount: 236, amountTotal: 235 }), true);
    });

    await t.test("detects a partial refund", () => {
        assert.equal(isFullyRefunded({ refundAmount: 100, amountTotal: 235 }), false);
    });
});
