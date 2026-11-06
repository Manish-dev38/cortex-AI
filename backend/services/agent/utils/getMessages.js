import axios from 'axios'
import { internalHeaders } from '../../../shared/internalAuth.js'

export const getMessages = async (conversationId, userId) => {
    try {
        const { data } = await axios.get(`${process.env.CHAT_SERVICE}/get-messages/${encodeURIComponent(conversationId)}`, {
            headers: internalHeaders(userId),
            timeout: 10_000,
        })
        return data
    } catch (error) {
        console.error("[agent] failed to load conversation history", error?.response?.status ?? error.message)
        return []
    }
}
