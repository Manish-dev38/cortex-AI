import api from "../../utils/axios"

export const createConversation = async () => {
    const { data } = await api.post("/api/chat/create-conversation")
    return data
}
