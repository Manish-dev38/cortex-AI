import mongoose from "mongoose"

const fileSchema = new mongoose.Schema({
    name: { type: String, maxlength: 128 },
    content: { type: String, maxlength: 100_000 },
}, {
    _id: false
})

const artifactSchema = new mongoose.Schema({
    id: Number,
    type: { type: String, maxlength: 64 },
    title: { type: String, maxlength: 200 },
    files: [fileSchema]
}, {
    _id: false
})

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true,
    },
    role: {
        type: String,
        enum: ["user", "assistant"],
        required: true,
    },
    content: {
        type: String,
        required: true,
        maxlength: 100_000,
    },
    images: [String],
    artifacts: [artifactSchema],
}, {
    timestamps: true
})

// No TTL here on purpose: messages live as long as their conversation. The
// chat service deletes orphans after the conversation TTL reaps the parent.
messageSchema.index({ conversationId: 1, createdAt: 1 })

const Message = mongoose.model("Message", messageSchema)
export default Message
