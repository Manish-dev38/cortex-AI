const PLAN_IDS = ["free", "starter", "pro"];

const DISPLAY = {
    free: "Free",
    starter: "Starter",
    pro: "Pro",
};

export function normalizePlanId(raw) {
    if (typeof raw !== "string") return "free";
    const value = raw.trim().toLowerCase();
    return PLAN_IDS.includes(value) ? value : "free";
}

export function formatPlan(raw) {
    return DISPLAY[normalizePlanId(raw)];
}

/**
 * A plan is only active until planExpiresAt. Expiry is enforced at read time
 * so no scheduled job is required for the stored value to be safe.
 */
export function effectivePlan(user, now = new Date()) {
    const plan = normalizePlanId(user?.plan);
    if (plan === "free") return "free";
    if (!user?.planExpiresAt) return plan;
    const expiresAt = new Date(user.planExpiresAt);
    if (Number.isNaN(expiresAt.getTime())) return "free";
    return expiresAt.getTime() > now.getTime() ? plan : "free";
}

export function sanitizeUser(user, now = new Date()) {
    if (!user) return null;
    const obj = typeof user.toObject === "function" ? user.toObject() : user;
    const plan = effectivePlan(obj, now);
    return {
        _id: obj.firebaseUid || obj._id,
        name: obj.name || "User",
        email: obj.email || "",
        avatar: obj.avatar || "",
        plan: formatPlan(plan),
        planId: plan,
        credits: Number.isFinite(obj.credits) ? obj.credits : 100,
        totalCredits: Number.isFinite(obj.totalCredits) ? obj.totalCredits : 100,
        planExpiresAt: plan === "free" ? null : (obj.planExpiresAt ?? null),
    };
}
