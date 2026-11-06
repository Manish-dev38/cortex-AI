import express from 'express'
import { agent } from '../controllers/agent.controller.js'
import multer from "../config/multer.js"
import { requireServiceToken, requireUserHeader } from '../../../shared/internalAuth.js'

const router = express.Router()

// The agent service is internal-only: the gateway injects the verified user.
router.use(requireServiceToken, requireUserHeader)

router.post("/chat", multer.single("file"), agent)

export default router
