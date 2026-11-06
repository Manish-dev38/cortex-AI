import axios from "axios"

/**
 * Per-upload collections are temporary. Leaving them behind leaks vector
 * storage and embedding spend for every PDF a user ever uploads.
 */
export async function deleteCollection(name) {
    if (!name || !process.env.QDRANT_URL) return
    const base = process.env.QDRANT_URL.replace(/\/+$/, "")
    try {
        await axios.delete(`${base}/collections/${encodeURIComponent(name)}`, {
            headers: process.env.QDRANT_API_KEY ? { "api-key": process.env.QDRANT_API_KEY } : {},
            timeout: 10_000,
        })
    } catch (error) {
        console.error("[agent] failed to delete vector collection", error?.response?.status ?? error.message)
    }
}
