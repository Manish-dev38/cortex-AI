import mongoose from "mongoose"

const THREE_DAYS_IN_SECONDS = 3 * 24 * 60 * 60

const conversationSchema = new mongoose.Schema({
    title: {
        type: String,
        default: "New Chat",
        maxlength: 200,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
}, {
    timestamps: true
})

// Retention is based on inactivity, not creation: an active conversation must
// not disappear mid-use. Messages are removed by the orphan sweep in
// index.js once their conversation expires.
conversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: THREE_DAYS_IN_SECONDS })
conversationSchema.index({ userId: 1, updatedAt: -1 })

const Conversation = mongoose.model("Conversation", conversationSchema)
export default Conversation
