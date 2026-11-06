import api from "../../utils/axios"

export const createOrder = async (plan) => {
    try {
        const { data } = await api.post("/api/billing/create", { plan })
        return data
    } catch (error) {
        const message = error.response?.data?.message || error.message || "Unable to create the order."
        throw new Error(message, { cause: error })
    }
}
