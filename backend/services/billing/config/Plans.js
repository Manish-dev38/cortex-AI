export const CURRENCY = "INR";
export const SUBUNIT_FACTOR = 100;
export const MIN_CHARGEABLE_PAISA = 100;

export const PLANS = {
    free:{
        id:"free",
        name:"Free",
        amount:0,
        credits:100,
        validity:30
    },
    starter:{
        id:"starter",
        name:"Starter",
        amount:199,
        credits:500,
        validity:30
    },
    pro:{
        id:"pro",
        name:"Pro",
        amount:499,
        credits:1000,
        validity:30,
    }
};

export const PLAN_IDS = Object.keys(PLANS);

// Explicit discount catalogue: unknown codes are rejected, never silently
// treated as zero, so coupon typos cannot become full-price surprises.
export const DISCOUNT_CODES = {
    WELCOME10: { percent: 10 },
};

// Proration for mid-cycle plan changes: credits the unused portion of the
// current plan against the new plan. All values are integer rupees.
export function calculateProration({ currentPlanId, newPlanId, daysRemaining }) {
    const current = PLANS[currentPlanId];
    const next = PLANS[newPlanId];
    if (!current || !next) return { proratedCredit: 0 };
    const remaining = Math.max(0, Math.min(Number(daysRemaining) || 0, current.validity));
    const proratedCredit = Math.floor((current.amount * remaining) / current.validity);
    return { proratedCredit };
}

export function pricePlan(planId, { discountCode = null, proratedCredit = 0, taxRate = 0.18 } = {}) {
    const plan = PLANS[planId];
    if (!plan) return null;
    const subtotal = Math.round(Number(plan.amount) || 0);
    let discount = 0;
    if (discountCode) {
        const entry = DISCOUNT_CODES[discountCode];
        if (!entry) return { error: "UNKNOWN_DISCOUNT_CODE" };
        discount = Math.floor((subtotal * entry.percent) / 100);
    }
    const credit = Math.max(0, Math.min(Math.round(Number(proratedCredit) || 0), subtotal - discount));
    const taxable = Math.max(0, subtotal - discount - credit);
    const tax = Math.round(taxable * taxRate);
    const total = taxable + tax;
    return {
        subtotal,
        discount,
        proratedCredit: credit,
        taxable,
        tax,
        total,
        amountPaise: total * SUBUNIT_FACTOR,
        currency: CURRENCY,
    };
}