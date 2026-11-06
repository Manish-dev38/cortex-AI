import express from 'express';
import { config } from './config/env.js';
import router from "./routes/billing.route.js";
import { securityHeaders } from "./middleware/billing.middleware.js";

export function createApp() {
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

    return app;
}
