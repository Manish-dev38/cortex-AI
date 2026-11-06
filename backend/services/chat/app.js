import express from 'express';
import router from './routes/chat.routes.js';

export function createApp() {
    const app = express();
    app.disable("x-powered-by");
    app.use((req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        next();
    });
    app.use(express.json({ limit: "256kb" }));
    app.use("/", router);

    app.get("/health", (req, res) => {
        res.json({ status: "ok" });
    });
    app.get("/", (req, res) => {
        res.json({ message: "hello from CHAT" });
    });

    app.use((req, res) => {
        res.status(404).json({ message: "Route not found" });
    });
    app.use((err, req, res, _next) => {
        console.error("[chat] unhandled error");
        if (res.headersSent) return;
        res.status(500).json({ message: "Unexpected error." });
    });

    return app;
}
