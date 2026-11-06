import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config/env.js';
import connectDb from './config/db.js';

async function start() {
    await connectDb();

    const app = createApp();
    const server = app.listen(config.port, config.host, () => {
        console.log(`auth listening on http://${config.host}:${config.port}`);
    });

    const shutdown = (signal) => {
        console.log(`[auth] ${signal} received, draining...`);
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
    console.error("[auth] startup aborted:", error.message);
    process.exit(1);
});
