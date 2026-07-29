import Razorpay from "razorpay"
import { config } from "./env.js"

// Credentials are validated once in config/env.js, which throws at boot when
// any required variable is missing instead of failing on the first order.
const razorpay = new Razorpay({
    key_id: config.razorKeyId,
    key_secret: config.razorKeySecret
})

export default razorpay