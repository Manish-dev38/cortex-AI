import { searchTool } from "../config/tavily.js"
import { chargeAgent, refundAgent, isInsufficientCredits } from "../utils/credits.js"

export const searchAgent = async (state) => {
    let charged = false

    try {
        await chargeAgent(state.userId, "search", state.requestId)
        charged = true

        const results = await searchTool.invoke({
            query: state.prompt
        })

        return {
            ...state,
            searchResults: results,
            images: Array.isArray(results?.images) ? results.images : []
        }
    } catch (error) {
        if (charged) {
            await refundAgent(state.userId, "search", state.requestId)
        }
        if (isInsufficientCredits(error)) throw error

        console.error("[search-agent] search failed:", error?.message ?? "unknown error")
        return {
            ...state,
            searchResults: [],
            images: []
        }
    }
}
