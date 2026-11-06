import crypto from "node:crypto";
import redis from "../../../shared/redis/redis.js";
import { config } from "../config/env.js";

const SESSION_TTL_SECONDS = config.sessionTtlDays * 24 * 60 * 60;

export function sessionCookieOptions() {
    const options = {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: config.cookieSameSite,
        path: "/",
        maxAge: SESSION_TTL_SECONDS * 1000,
    };
    if (config.cookieDomain) options.domain = config.cookieDomain;
    return options;
}

export function clearCookieOptions() {
    const options = {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: config.cookieSameSite,
        path: "/",
    };
    if (config.cookieDomain) options.domain = config.cookieDomain;
    return options;
}

/**
 * The session payload is identity only. Plan and credits are deliberately not
 * cached here, so they can never be stale or overwritten by a second login.
 */
export async function createSession(userId) {
    const sessionId = crypto.randomUUID();
    await redis.set(
        `session-${sessionId}`,
        JSON.stringify({ userId }),
        "EX",
        SESSION_TTL_SECONDS
    );
    return sessionId;
}

export async function destroySession(sessionId) {
    if (typeof sessionId !== "string" || sessionId.length === 0) return;
    await redis.del(`session-${sessionId}`);
}
