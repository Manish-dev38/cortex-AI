import express from 'express';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import connectDb from './config/db.js';
import router from "./routes/billing.route.js";
import { securityHeaders } from "./middleware/billing.middleware.js";

const app = express();
app.disable("x-powered-by");
app.use(securityHeaders);
// Preserve the raw body for webhook HMAC verification while still parsing
// JSON for every other route.
app.use(express.json({
    limit: config.bodyLimit,
    verify: (req, _res, buf) => {
        req.rawBody = Buffer.from(buf);
    },
}));
app.use("/", router);

app.get("/", (req, res) => {
    res.json({ message: "hello from BILLING" });
});

app.get("/health", (req, res) => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    res.json({ status: "ok", db: states[mongoose.connection.readyState] ?? "unknown" });
});

app.use((req, res) => {
    res.status(404).json({ code: "NOT_FOUND", message: "Route not found." });
});

// Centralised sanitiser: callers get codes, and server logs carry no request
// data, identifiers, or provider/downstream detail.
app.use((err, _req, res, _next) => {
    console.error("[billing] unhandled error");
    if (res.headersSent) return;
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Unexpected error. Retry later." });
});

async function start() {
    try {
        await connectDb();
    } catch (err) {
        console.error("[billing] startup aborted: database unreachable.");
        process.exit(1);
    }

    const server = app.listen(config.port, () => {
        console.log(`BILLING started on port ${config.port}`);
    });
    server.on("error", () => {
        console.error("[billing] listen failed");
        process.exit(1);
    });

    const shutdown = (signal) => {
        console.log(`[billing] ${signal} received, draining...`);
        server.close(async () => {
            try {
                await mongoose.disconnect();
            } catch {
                console.error("[billing] disconnect error");
            } finally {
                process.exit(0);
            }
        });
        setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

start();
