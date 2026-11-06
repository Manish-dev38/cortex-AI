import express from 'express'
import { createConversation, getConversations, getMessages, saveMessage, updateConversation } from '../controllers/chat.controller.js'
import { requireServiceToken, requireUserHeader } from '../../../shared/internalAuth.js'

const router = express.Router()

// Every chat route is internal: the gateway must prove service identity and
// supply the authenticated user id.
router.use(requireServiceToken, requireUserHeader)

router.post("/create-conversation", createConversation)
router.get("/get-conversations", getConversations)
router.post("/update-conversations", updateConversation)
router.post("/save-message", saveMessage)
router.get("/get-messages/:conversationId", getMessages)


export default router
