import express from 'express';
import cookieParser from 'cookie-parser';
import router from './routes/auth.route.js';

export function createApp() {
    const app = express();
    app.disable("x-powered-by");
    app.use((req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        next();
    });
    app.use(express.json({ limit: "64kb" }));
    app.use(cookieParser());
    app.use("/", router);

    app.get("/health", (req, res) => {
        res.json({ status: "ok" });
    });
    app.get("/", (req, res) => {
        res.json({ message: "hello from AUTH" });
    });

    app.use((req, res) => {
        res.status(404).json({ message: "Route not found" });
    });
    app.use((err, req, res, _next) => {
        console.error("[auth] unhandled error");
        if (res.headersSent) return;
        res.status(500).json({ message: "Unexpected error." });
    });

    return app;
}
