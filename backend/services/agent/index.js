import 'dotenv/config';
import mongoose from 'mongoose';
import connectDb from './config/db.js';
import { createApp } from './app.js';

const port = process.env.PORT || 3001;
const host = process.env.HOST || "127.0.0.1";

async function start() {
    if (!process.env.MONGODB_URI) {
        throw new Error("Missing required environment variable: MONGODB_URI");
    }
    if (!process.env.INTERNAL_SERVICE_TOKEN) {
        throw new Error("Missing required environment variable: INTERNAL_SERVICE_TOKEN");
    }

    await connectDb();

    const app = createApp();
    const server = app.listen(port, host, () => {
        console.log(`agent listening on http://${host}:${port}`);
    });

    const shutdown = (signal) => {
        console.log(`[agent] ${signal} received, draining...`);
        server.close(async () => {
            await mongoose.disconnect().catch(() => {});
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
    console.error("[agent] startup aborted:", error.message);
    process.exit(1);
});
