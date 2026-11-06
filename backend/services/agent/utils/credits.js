import axios from 'axios'
import { internalHeaders } from '../../../shared/internalAuth.js'

export class InsufficientCreditsError extends Error {
    constructor(required) {
        super("Not enough credits for this request.")
        this.name = "InsufficientCreditsError"
        this.code = "INSUFFICIENT_CREDITS"
        this.status = 402
        this.required = required
    }
}

function creditsUrl(path) {
    if (!process.env.AUTH_SERVICE) {
        throw new Error("AUTH_SERVICE is not configured")
    }
    return `${process.env.AUTH_SERVICE.replace(/\/+$/, "")}${path}`
}

/**
 * Reserves credits before generation. This fails closed: if auth is
 * unreachable or the balance is too low, the agent does not call the model.
 * The charge is idempotent per (request, agent) so retries cannot double-bill.
 */
export const chargeAgent = async (userId, agent, requestId) => {
    const idempotencyKey = `${requestId}:${agent}`
    try {
        const { data } = await axios.post(
            creditsUrl("/deduct-credits"),
            { requestId: idempotencyKey, userId, agent },
            { headers: internalHeaders(userId), timeout: 8_000 }
        )
        return data
    } catch (error) {
        if (error?.response?.status === 402) {
            throw new InsufficientCreditsError(error.response.data?.required)
        }
        throw new Error("Credit reservation failed")
    }
}

/**
 * Best-effort compensating refund when an agent fails after charging.
 * Idempotent on the auth side, so a retry cannot add credits twice.
 */
export const refundAgent = async (userId, agent, requestId) => {
    if (!userId || !requestId) return
    const idempotencyKey = `${requestId}:${agent}`
    try {
        await axios.post(
            creditsUrl("/refund-credits"),
            { requestId: idempotencyKey, userId },
            { headers: internalHeaders(userId), timeout: 8_000 }
        )
    } catch (error) {
        console.error("[agent] credit refund failed", error?.response?.status ?? error.message)
    }
}

export function isInsufficientCredits(error) {
    return error?.code === "INSUFFICIENT_CREDITS" || error?.status === 402
}
