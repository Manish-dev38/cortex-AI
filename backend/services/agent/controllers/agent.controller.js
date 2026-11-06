import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import axios from 'axios'
import { graph } from '../graph/graph.js'
import { addMessage } from '../config/memory.js'
import { internalHeaders } from '../../../shared/internalAuth.js'
import { isInsufficientCredits } from '../utils/credits.js'

const MAX_PROMPT_LENGTH = 8_000
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i

function chatUrl(path) {
    return `${process.env.CHAT_SERVICE.replace(/\/+$/, "")}${path}`
}

async function saveChatMessage(userId, body) {
    await axios.post(chatUrl("/save-message"), body, {
        headers: internalHeaders(userId),
        timeout: 10_000,
    })
}

export const agent = async (req, res) => {
    const userId = req.userId
    const { prompt, conversationId, agent: selectedAgent } = req.body ?? {}
    const file = req.file

    try {
        if (typeof prompt !== "string" || prompt.trim().length === 0) {
            return res.status(400).json({ code: "INVALID_PROMPT", message: "A prompt is required." })
        }
        if (prompt.length > MAX_PROMPT_LENGTH) {
            return res.status(400).json({ code: "PROMPT_TOO_LONG", message: `Prompts are limited to ${MAX_PROMPT_LENGTH} characters.` })
        }
        if (typeof conversationId !== "string" || !OBJECT_ID_PATTERN.test(conversationId)) {
            return res.status(400).json({ code: "INVALID_CONVERSATION", message: "A valid conversationId is required." })
        }

        const requestId = crypto.randomUUID()

        const result = await graph.invoke({
            prompt: prompt.trim(),
            conversationId,
            agent: selectedAgent,
            userId,
            requestId,
            file
        })

        const response = result.aiResponse
        if (typeof response !== "string" || response.length === 0) {
            return res.status(502).json({ code: "EMPTY_RESPONSE", message: "The agent did not return a response." })
        }

        // Persist the turn only after a successful generation, so a failed run
        // does not leave a half-conversation behind.
        await saveChatMessage(userId, {
            conversationId,
            role: "user",
            content: prompt.trim()
        })

        await saveChatMessage(userId, {
            conversationId,
            role: "assistant",
            content: response,
            images: result?.images,
            artifacts: result?.artifacts
        })

        await addMessage(conversationId, "user", prompt.trim())
        await addMessage(conversationId, "assistant", response)

        return res.status(200).json({
            answer: response,
            images: result?.images,
            artifacts: result?.artifacts
        })

    } catch (error) {
        if (isInsufficientCredits(error)) {
            return res.status(402).json({
                code: "INSUFFICIENT_CREDITS",
                message: "Not enough credits for this request.",
            })
        }

        console.error("[agent] request failed:", error?.message ?? "unknown error")
        return res.status(500).json({ code: "AGENT_FAILED", message: "The agent could not complete this request." })
    } finally {
        // Uploads are temporary for every agent path, including failures.
        if (file?.path) {
            await fs.unlink(file.path).catch(() => {})
        }
    }
}
