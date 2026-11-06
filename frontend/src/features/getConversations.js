import api from "../../utils/axios"

export const getConversation = async () => {
    try {
        const { data } = await api.get("/api/chat/get-conversations")
        return Array.isArray(data) ? data : []
    } catch {
        return []
    }
}
