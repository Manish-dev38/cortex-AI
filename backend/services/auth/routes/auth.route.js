import express from 'express'
import { login, logout, me } from '../controllers/auth.controller.js'
import {
    deductCredits,
    refundCredits,
    updateUserPayment,
    revokeCredits,
    restoreCredits,
} from '../controllers/credits.controller.js'
import { requireServiceToken, requireUserHeader } from '../../../shared/internalAuth.js'

const router = express.Router();

// Public: reached through the gateway without a service token.
router.post("/login", login)
router.get("/logout", logout)

// Internal only: proof of service identity is required. These endpoints used
// to be publicly reachable, which let anyone mint plans and credits.
router.get("/me", requireServiceToken, requireUserHeader, me)

router.post("/update-plan", requireServiceToken, updateUserPayment)
router.post("/deduct-credits", requireServiceToken, deductCredits)
router.post("/refund-credits", requireServiceToken, refundCredits)
router.post("/revoke-credits", requireServiceToken, revokeCredits)
router.post("/restore-credits", requireServiceToken, restoreCredits)


export default router
