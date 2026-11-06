import axios from "axios";
import { config } from "../config/env.js";

const headers = (userId) => {
    const h = { "x-service-token": config.internalToken };
    if (userId) h["x-user-id"] = userId;
    return h;
};

export async function getCurrentUser(userId) {
    const response = await axios.get(`${config.authService}/me`, {
        headers: headers(userId),
        timeout: config.authServiceTimeoutMs,
    });
    return response.data;
}

export async function revokeCredits({ userId, credits, refundAttemptId, downgrade }) {
    try {
        const response = await axios.post(
            `${config.authService}/revoke-credits`,
            { userId, credits, refundAttemptId, downgrade },
            { headers: headers(userId), timeout: config.authServiceTimeoutMs }
        );
        return { ok: true, data: response.data };
    } catch (error) {
        return { ok: false, status: error?.response?.status, code: error?.response?.data?.code };
    }
}

export async function restoreCredits({ userId, credits, refundAttemptId }) {
    try {
        const response = await axios.post(
            `${config.authService}/restore-credits`,
            { userId, credits, refundAttemptId },
            { headers: headers(userId), timeout: config.authServiceTimeoutMs }
        );
        return { ok: true, data: response.data };
    } catch (error) {
        console.error("[billing] credit restore failed", error?.response?.status ?? error.message);
        return { ok: false };
    }
}
