import express from 'express'
import dotenv from 'dotenv'
import proxy from 'express-http-proxy';
dotenv.config()
import cors from 'cors'
import cookieParser from 'cookie-parser';
import { proxyWithHeader } from './utils/proxyWithHeader.js';
import protect from './middleware/auth.middleware.js';
import morgan from "morgan"

const port = process.env.PORT || 5000;
const host = process.env.HOST || "127.0.0.1";
const isProduction = process.env.NODE_ENV === "production";

for (const name of ["AUTH_SERVICE", "CHAT_SERVICE", "AGENT_SERVICE", "BILLING_SERVICE"]) {
    if (!process.env[name]) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
}
if (!process.env.INTERNAL_SERVICE_TOKEN) {
    throw new Error("Missing required environment variable: INTERNAL_SERVICE_TOKEN");
}

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
});

const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        // Requests without an Origin header (curl, server-to-server) are not
        // subject to browser CORS validation.
        if (!origin) return callback(null, true);

        // Local Vite servers are trusted in development only. In production
        // the allow-list is the only permitted source.
        const isLocalViteServer = !isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
        if (configuredOrigins.includes(origin) || isLocalViteServer) {
            return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true
}));

app.use(cookieParser());
app.use(morgan(isProduction ? "combined" : "dev"))

app.use("/api/auth", proxy(process.env.AUTH_SERVICE))

// Provider webhooks are authenticated by their HMAC signature, not by a
// session, so they must bypass `protect`.
app.post("/api/billing/webhook", proxyWithHeader(process.env.BILLING_SERVICE, { path: "/webhook" }))

app.use("/api/chat", protect, proxyWithHeader(process.env.CHAT_SERVICE))
app.use("/api/agent", protect, proxyWithHeader(process.env.AGENT_SERVICE))
app.use("/api/billing", protect, proxyWithHeader(process.env.BILLING_SERVICE))

// The session only carries identity. Mutable account state (plan, credits)
// is read from the auth service on every request so it can never go stale.
app.get("/api/me", protect, proxyWithHeader(process.env.AUTH_SERVICE, { path: "/me" }))

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
})

app.get("/", (req, res) => {
    res.json({ message: "CortexAI gateway" });
})

app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
})

// Never leak internals (stack traces, headers, upstream details) to callers.
app.use((err, req, res, _next) => {
    console.error("[gateway] unhandled error");
    if (res.headersSent) return;
    res.status(500).json({ message: "Unexpected error." });
})

const server = app.listen(port, host, () => {
    console.log(`gateway listening on http://${host}:${port}`);
})

const shutdown = (signal) => {
    console.log(`[gateway] ${signal} received, draining...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
