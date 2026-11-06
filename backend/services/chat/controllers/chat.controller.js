import mongoose from "mongoose"
import Conversation from "../models/conversation.model.js"
import Message from "../models/message.model.js"

const MAX_CONTENT_LENGTH = 100_000
const MAX_TITLE_LENGTH = 200
const MAX_IMAGES = 10
const MAX_ARTIFACTS = 5
const MAX_FILES_PER_ARTIFACT = 20

function isObjectId(value) {
    return typeof value === "string" && mongoose.Types.ObjectId.isValid(value)
}

function validateArtifacts(artifacts) {
    if (artifacts === undefined || artifacts === null) return { ok: true, value: undefined }
    if (!Array.isArray(artifacts) || artifacts.length > MAX_ARTIFACTS) {
        return { ok: false, message: `artifacts must be an array of at most ${MAX_ARTIFACTS} items.` }
    }
    const cleaned = []
    for (const artifact of artifacts) {
        if (!artifact || typeof artifact !== "object") return { ok: false, message: "Invalid artifact." }
        const files = Array.isArray(artifact.files) ? artifact.files.slice(0, MAX_FILES_PER_ARTIFACT) : []
        cleaned.push({
            id: Number(artifact.id) || Date.now(),
            type: typeof artifact.type === "string" ? artifact.type.slice(0, 64) : "Project",
            title: typeof artifact.title === "string" ? artifact.title.slice(0, MAX_TITLE_LENGTH) : "",
            files: files
                .filter((file) => file && typeof file.name === "string" && typeof file.content === "string")
                .map((file) => ({
                    name: file.name.slice(0, 128),
                    content: file.content.slice(0, MAX_CONTENT_LENGTH),
                })),
        })
    }
    return { ok: true, value: cleaned }
}

export const createConversation = async (req, res) => {
    try {
        const conversation = await Conversation.create({
            userId: req.userId
        })

        return res.status(201).json(conversation)
    } catch (error) {
        console.error("[chat] create conversation failed")
        return res.status(500).json({ message: "Unable to create the conversation." })
    }
}

export const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            userId: req.userId
        }).sort({ updatedAt: -1 })

        return res.status(200).json(conversations)
    } catch (error) {
        console.error("[chat] list conversations failed")
        return res.status(500).json({ message: "Unable to load conversations." })
    }
}

export const saveMessage = async (req, res) => {
    try {
        const { conversationId, role, content, images, artifacts } = req.body ?? {};

        if (!isObjectId(conversationId)) {
            return res.status(400).json({ message: "A valid conversationId is required." })
        }
        if (role !== "user" && role !== "assistant") {
            return res.status(400).json({ message: "role must be 'user' or 'assistant'." })
        }
        if (typeof content !== "string" || content.length === 0 || content.length > MAX_CONTENT_LENGTH) {
            return res.status(400).json({ message: "content is required and must be a string under the size limit." })
        }

        const artifactsResult = validateArtifacts(artifacts)
        if (!artifactsResult.ok) {
            return res.status(400).json({ message: artifactsResult.message })
        }

        const conversation = await Conversation.exists({ _id: conversationId, userId: req.userId })
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found." })
        }

        const message = await Message.create({
            conversationId,
            role,
            content,
            images: Array.isArray(images) ? images.slice(0, MAX_IMAGES).filter((i) => typeof i === "string") : undefined,
            artifacts: artifactsResult.value
        })

        // Message writes must bump the conversation so the recents list is
        // ordered by activity rather than by creation time.
        await Conversation.updateOne({ _id: conversationId }, { $set: { updatedAt: new Date() } })

        return res.status(201).json(message)
    } catch (error) {
        console.error("[chat] save message failed")
        return res.status(500).json({ message: "Unable to save the message." })
    }
}

export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params
        if (!isObjectId(conversationId)) {
            return res.status(400).json({ message: "A valid conversationId is required." })
        }

        // Ownership check: conversation ids are guessable, so listing by id
        // alone exposed every user's history.
        const conversation = await Conversation.exists({ _id: conversationId, userId: req.userId })
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found." })
        }

        const messages = await Message.find({
            conversationId
        }).sort({ createdAt: 1 })

        return res.status(200).json(messages)
    } catch (error) {
        console.error("[chat] load messages failed")
        return res.status(500).json({ message: "Unable to load messages." })
    }
}

export const updateConversation = async (req, res) => {
    try {
        const { id, title } = req.body ?? {};

        if (!isObjectId(id)) {
            return res.status(400).json({ message: "A valid id is required." })
        }
        const cleanTitle = typeof title === "string" ? title.trim() : ""
        if (cleanTitle.length === 0 || cleanTitle.length > MAX_TITLE_LENGTH) {
            return res.status(400).json({ message: `title must be between 1 and ${MAX_TITLE_LENGTH} characters.` })
        }

        const conversation = await Conversation.findOneAndUpdate(
            { _id: id, userId: req.userId },
            { title: cleanTitle },
            { new: true }
        )

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found." })
        }

        return res.status(200).json(conversation)
    } catch (error) {
        console.error("[chat] update conversation failed")
        return res.status(500).json({ message: "Unable to update the conversation." })
    }
}
