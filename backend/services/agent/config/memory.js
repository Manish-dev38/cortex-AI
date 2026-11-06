import redis from '../../../shared/redis/redis.js'
import { getMessages } from '../utils/getMessages.js'

const MEMORY_TTL_SECONDS = 48 * 60 * 60
const MAX_MESSAGES = 38

export const getMemory = async (conversationId, userId) => {
    if (!conversationId) return []

    const key = `message-${conversationId}`
    const cached = await redis.get(key)

    if (cached) {
        try {
            return JSON.parse(cached)
        } catch {
            await redis.del(key)
        }
    }

    const messages = await getMessages(conversationId, userId)
    const safeMessages = Array.isArray(messages) ? messages : []

    await redis.set(key, JSON.stringify(safeMessages), "EX", MEMORY_TTL_SECONDS)

    return safeMessages
}


export const addMessage = async (conversationId, role, content) => {
    if (!conversationId) return

    const key = `message-${conversationId}`
    const rawMessages = await redis.get(key)
    let messages = []
    if (rawMessages) {
        try {
            messages = JSON.parse(rawMessages)
        } catch {
            messages = []
        }
    }
    messages.push({
        role,
        content
    })

    if (messages.length > MAX_MESSAGES) {
        messages = messages.slice(messages.length - MAX_MESSAGES)
    }

    // Always set the TTL: without it the cached history would live forever
    // even though the database copy expires.
    await redis.set(key, JSON.stringify(messages), "EX", MEMORY_TTL_SECONDS)
}
