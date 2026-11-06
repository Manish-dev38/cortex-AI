import test from "node:test";
import assert from "node:assert/strict";
import { requireServiceToken, requireUserHeader, internalHeaders } from "../internalAuth.js";

const TOKEN = "test-service-token";

function mockResponse() {
    const res = {
        statusCode: null,
        body: null,
    };
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (body) => {
        res.body = body;
        return res;
    };
    return res;
}

function mockRequest({ token, userId } = {}) {
    const headers = {};
    if (token !== undefined) headers["x-service-token"] = token;
    if (userId !== undefined) headers["x-user-id"] = userId;
    return { headers };
}

function withToken(value, fn) {
    return async () => {
        const previous = process.env.INTERNAL_SERVICE_TOKEN;
        try {
            if (value === undefined) delete process.env.INTERNAL_SERVICE_TOKEN;
            else process.env.INTERNAL_SERVICE_TOKEN = value;
            await fn();
        } finally {
            if (previous === undefined) delete process.env.INTERNAL_SERVICE_TOKEN;
            else process.env.INTERNAL_SERVICE_TOKEN = previous;
        }
    };
}

test("requireServiceToken", async (t) => {
    await t.test("fails closed when the token is not configured", withToken(undefined, async () => {
        const res = mockResponse();
        let nextCalled = false;
        requireServiceToken(mockRequest({ token: "anything" }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.code, "SERVICE_TOKEN_NOT_CONFIGURED");
        assert.equal(nextCalled, false);
    }));

    await t.test("rejects a missing token", withToken(TOKEN, async () => {
        const res = mockResponse();
        let nextCalled = false;
        requireServiceToken(mockRequest({}), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 401);
        assert.equal(nextCalled, false);
    }));

    await t.test("rejects a token with the wrong length", withToken(TOKEN, async () => {
        const res = mockResponse();
        let nextCalled = false;
        requireServiceToken(mockRequest({ token: "short" }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 401);
        assert.equal(nextCalled, false);
    }));

    await t.test("rejects a same-length wrong token", withToken(TOKEN, async () => {
        const res = mockResponse();
        let nextCalled = false;
        const wrong = "x".repeat(TOKEN.length);
        requireServiceToken(mockRequest({ token: wrong }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 401);
        assert.equal(nextCalled, false);
    }));

    await t.test("accepts the configured token", withToken(TOKEN, async () => {
        const res = mockResponse();
        let nextCalled = false;
        requireServiceToken(mockRequest({ token: TOKEN }), res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(res.statusCode, null);
    }));
});

test("requireUserHeader", async (t) => {
    await t.test("rejects a missing user id", async () => {
        const res = mockResponse();
        let nextCalled = false;
        requireUserHeader(mockRequest({}), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 401);
        assert.equal(nextCalled, false);
    });

    await t.test("rejects ids with forbidden characters", async () => {
        const res = mockResponse();
        let nextCalled = false;
        requireUserHeader(mockRequest({ userId: "user/../admin" }), res, () => { nextCalled = true; });
        assert.equal(res.statusCode, 401);
        assert.equal(nextCalled, false);
    });

    await t.test("trims and stores a valid user id", async () => {
        const req = mockRequest({ userId: "  firebase-uid_123  " });
        const res = mockResponse();
        let nextCalled = false;
        requireUserHeader(req, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(req.userId, "firebase-uid_123");
    });
});

test("internalHeaders", async (t) => {
    await t.test("includes the token and user when configured", withToken(TOKEN, async () => {
        const headers = internalHeaders("user-1");
        assert.equal(headers["x-service-token"], TOKEN);
        assert.equal(headers["x-user-id"], "user-1");
    }));

    await t.test("omits the token when it is not configured", withToken(undefined, async () => {
        const headers = internalHeaders("user-1");
        assert.equal(headers["x-service-token"], undefined);
        assert.equal(headers["x-user-id"], "user-1");
    }));
});
