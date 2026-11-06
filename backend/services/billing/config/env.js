import dotenv from "dotenv";

dotenv.config();

const OPTIONAL_DEFAULTS = {
    PORT: "8004",
    RAZOR_WEBHOOK_SECRET: "",
    AUTH_SERVICE_TIMEOUT_MS: "8000",
    CUSTOM_DNS_SERVERS: "",
    TAX_RATE_GST: "0.18",
    BODY_LIMIT: "100kb",
    HOST: "127.0.0.1",
};

function readEnv(name) {
    const raw = process.env[name] ?? OPTIONAL_DEFAULTS[name] ?? "";
    return typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
}

function requireEnv(name) {
    const value = readEnv(name);
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function looksPlaceholder(value) {
    return /^(change-me|replace-me|your-|placeholder|xxx)/i.test(value);
}

// Fail fast on missing configuration. Throws before any socket is opened.
const MONGODB_URI = requireEnv("MONGODB_URI");
const RAZOR_KEY_ID = requireEnv("RAZOR_KEY_ID");
const RAZOR_KEY_SECRET = requireEnv("RAZOR_KEY_SECRET");
const AUTH_SERVICE = requireEnv("AUTH_SERVICE").replace(/\/+$/, "");
// Billing calls privileged auth endpoints, so the shared service token is
// mandatory, not optional.
const INTERNAL_SERVICE_TOKEN = requireEnv("INTERNAL_SERVICE_TOKEN");

if (looksPlaceholder(MONGODB_URI) || looksPlaceholder(RAZOR_KEY_SECRET)) {
    throw new Error("Placeholder credentials detected. Set real environment variables via the secret manager.");
}

if (!/^https?:\/\/.+/.test(AUTH_SERVICE)) {
    throw new Error("AUTH_SERVICE must be an absolute http(s) URL without trailing slash.");
}

const PORT = Number.parseInt(readEnv("PORT") || "8004", 10);
if (!Number.isSafeInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
}

const AUTH_SERVICE_TIMEOUT_MS = Number.parseInt(readEnv("AUTH_SERVICE_TIMEOUT_MS"), 10);
if (!Number.isSafeInteger(AUTH_SERVICE_TIMEOUT_MS) || AUTH_SERVICE_TIMEOUT_MS < 1000 || AUTH_SERVICE_TIMEOUT_MS > 30000) {
    throw new Error("AUTH_SERVICE_TIMEOUT_MS must be an integer between 1000 and 30000.");
}

const TAX_RATE_GST = Number.parseFloat(readEnv("TAX_RATE_GST"));
if (!Number.isFinite(TAX_RATE_GST) || TAX_RATE_GST < 0 || TAX_RATE_GST > 1) {
    throw new Error("TAX_RATE_GST must be a number between 0 and 1.");
}

export const config = {
    port: PORT,
    host: readEnv("HOST") || "127.0.0.1",
    mongodbUri: MONGODB_URI,
    razorKeyId: RAZOR_KEY_ID,
    razorKeySecret: RAZOR_KEY_SECRET,
    // Webhooks are authenticated by their own secret; falls back to the API
    // secret only when a dedicated webhook secret is not configured.
    razorWebhookSecret: readEnv("RAZOR_WEBHOOK_SECRET") || RAZOR_KEY_SECRET,
    authService: AUTH_SERVICE,
    authServiceTimeoutMs: AUTH_SERVICE_TIMEOUT_MS,
    internalToken: INTERNAL_SERVICE_TOKEN,
    customDnsServers: readEnv("CUSTOM_DNS_SERVERS")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    taxRateGst: TAX_RATE_GST,
    bodyLimit: readEnv("BODY_LIMIT") || "100kb",
};
