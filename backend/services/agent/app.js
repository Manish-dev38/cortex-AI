import express from 'express';
import router from './routes/agent.route.js';

export function createApp() {
    const app = express();
    app.disable("x-powered-by");
    app.use((req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        next();
    });
    // Multipart requests are parsed by multer per route; this limit is for
    // JSON bodies only.
    app.use(express.json({ limit: "256kb" }));
    app.use("/", router);

    app.get("/health", (req, res) => {
        res.json({ status: "ok" });
    });
    app.get("/", (req, res) => {
        res.json({ message: "hello from AGENT" });
    });

    app.use((req, res) => {
        res.status(404).json({ message: "Route not found" });
    });
    app.use((err, req, res, _next) => {
        if (err?.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "File is too large. Maximum size is 20MB." });
        }
        if (err?.message === "Only PDF and image uploads are allowed.") {
            return res.status(400).json({ message: err.message });
        }
        console.error("[agent] unhandled error");
        if (res.headersSent) return;
        res.status(500).json({ message: "Unexpected error." });
    });

    return app;
}
