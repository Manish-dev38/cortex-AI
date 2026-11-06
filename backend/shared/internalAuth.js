import crypto from "node:crypto";

const USER_ID_PATTERN = /^[A-Za-z0-9._:=-]{1,128}$/;
const TOKEN_HEADER = "x-service-token";

function timingSafeEqualString(a, b) {
    const bufA = Buffer.from(String(a), "utf8");
    const bufB = Buffer.from(String(b), "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Services other than the gateway must not be reachable by browsers or
 * anonymous clients. The gateway is the only public surface and proves its
 * identity with a shared token on every proxied call.
 */
export function requireServiceToken(req, res, next) {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
        return res.status(503).json({
            code: "SERVICE_TOKEN_NOT_CONFIGURED",
            message: "Internal authentication is not configured.",
        });
    }

    const provided = req.headers[TOKEN_HEADER];
    if (typeof provided !== "string" || !timingSafeEqualString(provided, expected)) {
        return res.status(401).json({
            code: "INVALID_SERVICE_TOKEN",
            message: "Internal service token is missing or invalid.",
        });
    }

    return next();
}

/**
 * The gateway resolves the session cookie to a user id and forwards it as
 * x-user-id. Downstream services must never trust this header from the
 * public internet, which is why requireServiceToken runs first.
 */
export function requireUserHeader(req, res, next) {
    const raw = req.headers["x-user-id"];
    const userId = Array.isArray(raw) ? raw[0] : raw;

    if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId.trim())) {
        return res.status(401).json({
            code: "MISSING_USER",
            message: "Authenticated user identity is required.",
        });
    }

    req.userId = userId.trim();
    return next();
}

export function isValidUserId(userId) {
    return typeof userId === "string" && USER_ID_PATTERN.test(userId.trim());
}

export function internalHeaders(userId) {
    const headers = {};
    if (process.env.INTERNAL_SERVICE_TOKEN) {
        headers[TOKEN_HEADER] = process.env.INTERNAL_SERVICE_TOKEN;
    }
    if (userId) {
        headers["x-user-id"] = userId;
    }
    return headers;
}
