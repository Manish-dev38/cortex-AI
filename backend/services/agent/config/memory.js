import redis from '../../../shared/redis/redis.js'
import { getMessages } from '../utils/getMessages.js'

export const getMemory = async (conversationId) => {
    const key = `message-${conversationId}`
    const cached = await redis.get(key)

    if (cached) {
        return JSON.parse(cached)
    }

    const messages = await getMessages(conversationId)

    await redis.set(key, JSON.stringify(messages), "EX", 48 * 60 * 60)

    return messages

}


export const addMessage = async (conversationId, role, content) => {
    const key = `message-${conversationId}`
    const rawMessages = await redis.get(key)
    const messages = rawMessages ? JSON.parse(rawMessages) : []
    messages.push({
        role,
        content
    })

    if (messages.length > 38) {
        messages.shift()
    }

    await redis.set(key, JSON.stringify(messages))
}