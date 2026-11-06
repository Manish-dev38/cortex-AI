import 'dotenv/config';
import mongoose from 'mongoose';
import connectDb from './config/db.js';
import { createApp } from './app.js';
import Conversation from './models/conversation.model.js';
import Message from './models/message.model.js';

const port = process.env.PORT || 8002;
const host = process.env.HOST || "127.0.0.1";

async function removeOrphanMessages() {
    try {
        const conversationIds = await Conversation.distinct("_id");
        const result = await Message.deleteMany({ conversationId: { $nin: conversationIds } });
        if (result.deletedCount > 0) {
            console.log(`[chat] removed ${result.deletedCount} orphan messages`);
        }
    } catch (error) {
        console.error("[chat] orphan message sweep failed");
    }
}

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
        console.log(`chat listening on http://${host}:${port}`);
    });

    // Mongo TTL cannot cascade, so sweep messages whose conversation expired.
    const sweep = setInterval(removeOrphanMessages, 60 * 60 * 1000);
    sweep.unref();

    const shutdown = (signal) => {
        console.log(`[chat] ${signal} received, draining...`);
        clearInterval(sweep);
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
    console.error("[chat] startup aborted:", error.message);
    process.exit(1);
});
