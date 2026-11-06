import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.INTERNAL_SERVICE_TOKEN = "test-service-token";

const TOKEN = "test-service-token";
const OWNER = "user-owner";
const OTHER = "user-other";

let app;
let request;
let Conversation;
let Message;
let mongo;

before(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongo = await MongoMemoryServer.create();

    await mongoose.connect(mongo.getUri(), { dbName: "cortex-chat-test" });

    ({ default: Conversation } = await import("../models/conversation.model.js"));
    ({ default: Message } = await import("../models/message.model.js"));
    ({ default: request } = await import("supertest"));
    const { createApp } = await import("../app.js");

    await Conversation.init();
    await Message.init();

    app = createApp();
});

after(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
});

beforeEach(async () => {
    await Conversation.deleteMany({});
    await Message.deleteMany({});
});

function call(method, path, { token = TOKEN, userId, body } = {}) {
    const req = request(app)[method](path);
    if (token) req.set("x-service-token", token);
    if (userId) req.set("x-user-id", userId);
    return body === undefined ? req : req.send(body);
}

test("chat routes require the service token and an injected user", async () => {
    const noToken = await call("get", "/get-conversations", { token: null, userId: OWNER });
    assert.equal(noToken.status, 401);

    const noUser = await call("get", "/get-conversations", { userId: null });
    assert.equal(noUser.status, 401);
});

test("create-conversation binds the conversation to the injected user", async () => {
    const res = await call("post", "/create-conversation", { userId: OWNER });
    assert.equal(res.status, 201);
    assert.equal(res.body.userId, OWNER);
});

test("conversation listing is scoped to the caller", async () => {
    await Conversation.create({ userId: OWNER, title: "Mine" });
    await Conversation.create({ userId: OTHER, title: "Theirs" });

    const res = await call("get", "/get-conversations", { userId: OWNER });
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].title, "Mine");
});

test("reading another user's messages is refused (IDOR)", async () => {
    const foreign = await Conversation.create({ userId: OTHER, title: "Secret" });
    await Message.create({ conversationId: foreign._id, role: "user", content: "private" });

    const res = await call("get", `/get-messages/${foreign._id}`, { userId: OWNER });
    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Conversation not found.");
});

test("reading your own messages succeeds in chronological order", async () => {
    const own = await Conversation.create({ userId: OWNER, title: "Mine" });
    await Message.create({ conversationId: own._id, role: "user", content: "first" });
    await Message.create({ conversationId: own._id, role: "assistant", content: "second" });

    const res = await call("get", `/get-messages/${own._id}`, { userId: OWNER });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((m) => m.content), ["first", "second"]);
});

test("writing a message to another user's conversation is refused", async () => {
    const foreign = await Conversation.create({ userId: OTHER, title: "Secret" });

    const res = await call("post", "/save-message", {
        userId: OWNER,
        body: { conversationId: String(foreign._id), role: "user", content: "hijack" },
    });

    assert.equal(res.status, 404);
    assert.equal(await Message.countDocuments({ conversationId: foreign._id }), 0);
});

test("renaming another user's conversation is refused", async () => {
    const foreign = await Conversation.create({ userId: OTHER, title: "Secret" });

    const res = await call("post", "/update-conversations", {
        userId: OWNER,
        body: { id: String(foreign._id), title: "Hijacked" },
    });

    assert.equal(res.status, 404);
    const unchanged = await Conversation.findById(foreign._id);
    assert.equal(unchanged.title, "Secret");
});

test("message payload validation rejects bad roles and oversized content", async () => {
    const own = await Conversation.create({ userId: OWNER, title: "Mine" });

    const badRole = await call("post", "/save-message", {
        userId: OWNER,
        body: { conversationId: String(own._id), role: "system", content: "x" },
    });
    assert.equal(badRole.status, 400);

    const tooLong = await call("post", "/save-message", {
        userId: OWNER,
        body: { conversationId: String(own._id), role: "user", content: "x".repeat(100_001) },
    });
    assert.equal(tooLong.status, 400);
});
