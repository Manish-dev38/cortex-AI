import dotenv from "dotenv";

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || "development";

function required(name) {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value.trim();
}

function integer(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    const value = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw new Error(`${name} must be an integer between ${min} and ${max}.`);
    }
    return value;
}

export const config = {
    nodeEnv: NODE_ENV,
    isProduction: NODE_ENV === "production",
    port: integer("PORT", 7001, { min: 1, max: 65535 }),
    host: process.env.HOST?.trim() || "127.0.0.1",
    mongodbUri: required("MONGODB_URI"),
    internalToken: required("INTERNAL_SERVICE_TOKEN"),
    sessionTtlDays: integer("SESSION_TTL_DAYS", 7, { min: 1, max: 30 }),
    cookieSecure: process.env.COOKIE_SECURE === "true" || NODE_ENV === "production",
    cookieSameSite: process.env.COOKIE_SAME_SITE?.trim() || "lax",
    cookieDomain: process.env.COOKIE_DOMAIN?.trim() || undefined,
};
