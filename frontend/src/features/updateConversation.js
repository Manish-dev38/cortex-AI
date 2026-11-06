import api from "../../utils/axios.js"

export const updateConversation = async (payload) => {
    const { data } = await api.post("/api/chat/update-conversations", payload)
    return data
}
