import mongoose from 'mongoose';
import { config } from './config/env.js';
import connectDb from './config/db.js';
import { createApp } from './app.js';

async function start() {
    try {
        await connectDb();
    } catch (err) {
        console.error("[billing] startup aborted: database unreachable.");
        process.exit(1);
    }

    const app = createApp();
    const server = app.listen(config.port, config.host, () => {
        console.log(`BILLING started on http://${config.host}:${config.port}`);
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
