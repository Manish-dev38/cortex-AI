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
import { requireServiceToken } from "../../../shared/internalAuth.js"

const router = express.Router()

// Webhooks carry provider signatures, not user sessions, and must see the
// raw body: index.js preserves req.rawBody for this route. They are the only
// endpoints reachable without the internal service token.
router.post("/webhook", rateLimit({ max: 120 }), handleWebhook)

// Everything else is internal: the gateway proves service identity and
// injects the authenticated user id.
router.use(requireServiceToken, requireUser)

router.post("/create", rateLimit({ max: 30 }), createOrder)
router.post("/verify", rateLimit({ max: 60 }), verifyPayment)
router.post("/refund", rateLimit({ max: 20 }), requestRefund)
router.post("/cancel", rateLimit({ max: 20 }), cancelSubscription)
router.get("/payments/:orderId", rateLimit({ max: 120 }), getPayment)

export default router
