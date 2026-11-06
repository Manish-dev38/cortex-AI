import redis from "../../shared/redis/redis.js"

/**
 * Resolves the opaque session cookie to a user id. The Redis payload is
 * intentionally minimal ({ userId }) so plan/credits can never be stale here.
 */
const protect = async (req, res, next) => {
    try {
        const sessionId = req.cookies?.session
        if (!sessionId || typeof sessionId !== "string") {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const session = await redis.get(`session-${sessionId}`)
        if (!session) {
            return res.status(401).json({ message: "Session expired" })
        }

        let parsed
        try {
            parsed = JSON.parse(session)
        } catch {
            return res.status(401).json({ message: "Session expired" })
        }

        const userId = parsed?.userId
        if (typeof userId !== "string" || userId.length === 0) {
            return res.status(401).json({ message: "Session expired" })
        }

        req.userId = userId
        return next()
    } catch (error) {
        console.error("[gateway] session lookup failed")
        return res.status(500).json({ message: "Unexpected error." })
    }
}

export default protect
