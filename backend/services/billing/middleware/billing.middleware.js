const USER_ID_PATTERN = /^[A-Za-z0-9._:=-]{1,128}$/;

// The gateway injects x-user-id from a verified session. Billing runs behind
// the gateway but also listens directly, so it must reject missing or
// malformed identities instead of persisting whatever it receives.
export function requireUser(req, res, next) {
    const raw = req.headers["x-user-id"];
    const userId = Array.isArray(raw) ? raw[0] : raw;
    if (typeof userId !== "string" || userId.trim().length === 0) {
        return res.status(401).json({ code: "MISSING_USER", message: "Authenticated user identity is required." });
    }
    const value = userId.trim();
    if (!USER_ID_PATTERN.test(value)) {
        return res.status(401).json({ code: "INVALID_USER", message: "Authenticated user identity is invalid." });
    }
    req.userId = value;
    return next();
}

export function securityHeaders(req, res, next) {
    res.removeHeader("X-Powered-By");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return next();
}

// Dependency-free sliding-window limiter (per IP + route) so order and
// verify endpoints cannot be spammed into provider-quota exhaustion.
const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 60 } = {}) {
    return (req, res, next) => {
        const key = `${req.ip ?? "unknown"}:${req.path}`;
        const now = Date.now();
        const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
        if (hits.length >= max) {
            const retryAfter = Math.ceil((hits[0] + windowMs - now) / 1000);
            res.setHeader("Retry-After", String(Math.max(retryAfter, 1)));
            return res.status(429).json({ code: "RATE_LIMITED", message: "Too many requests. Retry later." });
        }
        hits.push(now);
        if (buckets.size > 5000) {
            for (const [k, v] of buckets) {
                if (v.length === 0 || now - v[v.length - 1] > windowMs) buckets.delete(k);
                if (buckets.size <= 4000) break;
            }
        }
        buckets.set(key, hits);
        return next();
    };
}
