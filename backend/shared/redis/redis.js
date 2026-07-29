import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

const redis = new Redis(redisUrl, {
    lazyConnect: false,
    retryStrategy(times) {
        if (times > 5) {
            console.error('Redis: too many reconnect attempts, giving up')
            return null
        }
        return Math.min(times * 200, 2000)
    }
})

redis.on("connect", () => {
    console.log(`Redis Connected to ${redisUrl}`)
})

redis.on("error", (err) => {
    console.error("Redis connection error:", err.message)
})

export default redis