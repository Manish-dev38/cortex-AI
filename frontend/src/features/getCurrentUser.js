import api from "../../utils/axios.js"

const getCurrentUser = async () => {
    try {
        const response = await api.get("/api/me", {
            validateStatus: (status) => status === 200 || status === 401
        });
        return response.status === 200 ? response.data : null
    } catch {
        return null
    }
}

export default getCurrentUser
