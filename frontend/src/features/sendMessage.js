import api from '../../utils/axios.js'

async function sendMessage(payload) {
    try {
        const { data } = await api.post("/api/agent/chat", payload)
        return data
    } catch (error) {
        // Surface the reason (402, validation, upstream failure) instead of
        // silently returning null and leaving the UI stuck.
        const message = error.response?.data?.message
            || (error.response?.status === 402 ? "You are out of credits for this request." : null)
            || error.message
            || "Unable to send this message."
        throw new Error(message, { cause: error })
    }
}

export default sendMessage
