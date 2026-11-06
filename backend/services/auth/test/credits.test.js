import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Must be set before the app (and its env loader) is imported.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/cortex-auth-test";
process.env.INTERNAL_SERVICE_TOKEN = "test-service-token";

const TOKEN = "test-service-token";
const USER = "user-1";

let app;
let request;
let User;
let CreditTransaction;
let mongo;
let redis;

before(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongo = await MongoMemoryServer.create();

    await mongoose.connect(mongo.getUri(), { dbName: "cortex-auth-test" });

    ({ default: User } = await import("../models/user.model.js"));
    ({ default: CreditTransaction } = await import("../models/creditTransaction.model.js"));
    ({ default: request } = await import("supertest"));
    ({ default: redis } = await import("../../../shared/redis/redis.js"));
    const { createApp } = await import("../app.js");

    // Idempotency depends on unique indexes actually existing.
    await User.init();
    await CreditTransaction.init();

    app = createApp();
});

after(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    if (redis) await redis.quit().catch(() => {});
});

beforeEach(async () => {
    await User.deleteMany({});
    await CreditTransaction.deleteMany({});
});

function post(path, body, { token = TOKEN, userId } = {}) {
    const req = request(app).post(path);
    if (token) req.set("x-service-token", token);
    if (userId) req.set("x-user-id", userId);
    return req.send(body);
}

async function seedUser({ credits = 100, totalCredits = 100 } = {}) {
    return User.create({
        _id: USER,
        firebaseUid: USER,
        name: "Test User",
        email: "test@example.com",
        plan: "free",
        credits,
        totalCredits,
    });
}

test("internal credit endpoints require the service token", async () => {
    await seedUser();
    const res = await post("/deduct-credits", { requestId: "req-no-token", userId: USER, agent: "chat" }, { token: null });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "INVALID_SERVICE_TOKEN");
});

test("deduct-credits rejects unknown agents and bad ids", async () => {
    await seedUser();
    const unknownAgent = await post("/deduct-credits", { requestId: "req-1", userId: USER, agent: "root" });
    assert.equal(unknownAgent.status, 400);

    const badRequestId = await post("/deduct-credits", { requestId: "bad id!", userId: USER, agent: "chat" });
    assert.equal(badRequestId.status, 400);
});

test("concurrent reservations cannot overspend a balance", async () => {
    // coding costs 10; the user can afford exactly one.
    await seedUser({ credits: 10, totalCredits: 10 });

    const [first, second] = await Promise.all([
        post("/deduct-credits", { requestId: "race-a", userId: USER, agent: "coding" }),
        post("/deduct-credits", { requestId: "race-b", userId: USER, agent: "coding" }),
    ]);

    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 402]);

    const user = await User.findOne({ firebaseUid: USER });
    assert.equal(user.credits, 0);

    const applied = await CreditTransaction.countDocuments({ type: "reserve", status: "applied" });
    assert.equal(applied, 1);
});

test("a replayed reservation charges only once", async () => {
    await seedUser({ credits: 100, totalCredits: 100 });
    const payload = { requestId: "replay-1", userId: USER, agent: "chat" };

    const first = await post("/deduct-credits", payload);
    const second = await post("/deduct-credits", payload);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.body.duplicate, true);

    const user = await User.findOne({ firebaseUid: USER });
    assert.equal(user.credits, 97);

    assert.equal(await CreditTransaction.countDocuments({ type: "reserve" }), 1);
});

test("refund restores the reserved amount exactly once", async () => {
    await seedUser({ credits: 100, totalCredits: 100 });

    const charge = await post("/deduct-credits", { requestId: "refund-1", userId: USER, agent: "coding" });
    assert.equal(charge.status, 200);

    const first = await post("/refund-credits", { requestId: "refund-1", userId: USER });
    const second = await post("/refund-credits", { requestId: "refund-1", userId: USER });

    assert.equal(first.status, 200);
    assert.equal(first.body.refunded, 10);
    assert.equal(second.status, 200);
    assert.equal(second.body.duplicate, true);

    const user = await User.findOne({ firebaseUid: USER });
    assert.equal(user.credits, 100);
});

test("refund requires an applied reservation", async () => {
    await seedUser();
    const res = await post("/refund-credits", { requestId: "never-charged", userId: USER });
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "RESERVATION_NOT_FOUND");
});

test("update-plan grants credits once per order and returns the lowercase plan", async () => {
    await seedUser({ credits: 100, totalCredits: 100 });
    const payload = { plan: "starter", credits: 500, userId: USER, orderId: "order_abc" };

    const first = await post("/update-plan", payload);
    const replay = await post("/update-plan", payload);

    assert.equal(first.status, 200);
    assert.equal(first.body.plan, "starter");
    assert.equal(first.body.credits, 500, "acknowledges the granted amount, not the new balance");
    assert.equal(replay.status, 200);
    assert.equal(replay.body.duplicate, true);

    const user = await User.findOne({ firebaseUid: USER });
    assert.equal(user.credits, 600);
    assert.equal(user.totalCredits, 600);
    assert.equal(user.plan, "starter");
    assert.ok(user.planExpiresAt instanceof Date);
});

test("revoke-credits refuses a refund once the credits are spent", async () => {
    await seedUser({ credits: 2, totalCredits: 500 });

    const res = await post("/revoke-credits", {
        userId: USER,
        credits: 500,
        refundAttemptId: "refund-attempt-1",
        downgrade: true,
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.code, "CREDITS_SPENT");

    const user = await User.findOne({ firebaseUid: USER });
    assert.equal(user.credits, 2);
    assert.equal(user.plan, "free");
});

test("revoke-credits and restore-credits are idempotent", async () => {
    await seedUser({ credits: 800, totalCredits: 800 });

    const revoke = await post("/revoke-credits", {
        userId: USER,
        credits: 300,
        refundAttemptId: "refund-attempt-2",
        downgrade: false,
    });
    const revokeReplay = await post("/revoke-credits", {
        userId: USER,
        credits: 300,
        refundAttemptId: "refund-attempt-2",
        downgrade: false,
    });

    assert.equal(revoke.status, 200);
    assert.equal(revokeReplay.body.duplicate, true);
    assert.equal((await User.findOne({ firebaseUid: USER })).credits, 500);

    await post("/restore-credits", { userId: USER, credits: 300, refundAttemptId: "refund-attempt-2" });
    await post("/restore-credits", { userId: USER, credits: 300, refundAttemptId: "refund-attempt-2" });

    const user = await User.findOne({ firebaseUid: USER });
    assert.equal(user.credits, 800);
    assert.equal(user.totalCredits, 800);
});
