import express from "express"
import {
    createOrder,
    verifyPayment,
    handleWebhook,
    requestRefund,
    cancelSubscription,
    getPayment,
} from "../controller/billing.controller.js"
import { requireUser, rateLimit } from "../middleware/billing.middleware.js"

const router = express.Router()

// Webhooks carry provider signatures, not user sessions, and must see the
// raw body: index.js preserves req.rawBody for this route.
router.post("/webhook", rateLimit({ max: 120 }), handleWebhook)
router.post("/create", requireUser, rateLimit({ max: 30 }), createOrder)
router.post("/verify", requireUser, rateLimit({ max: 60 }), verifyPayment)
router.post("/refund", requireUser, rateLimit({ max: 20 }), requestRefund)
router.post("/cancel", requireUser, rateLimit({ max: 20 }), cancelSubscription)
router.get("/payments/:orderId", requireUser, rateLimit({ max: 120 }), getPayment)

export default router
