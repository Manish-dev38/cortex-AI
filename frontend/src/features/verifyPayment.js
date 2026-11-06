import api from "../../utils/axios"

export const verifyPayment = async (payload) => {
    try {
        const { data } = await api.post("/api/billing/verify", payload)
        return data
    } catch (error) {
        const message = error.response?.data?.message || error.message || "Unable to verify the payment."
        throw new Error(message, { cause: error })
    }
}
