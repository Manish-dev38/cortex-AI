import mongoose from "mongoose"

const conversationSchema = new mongoose.Schema({
    title: {
        type: String,
        default: "New Chat"
    },
    userId: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3 * 24 * 60 * 60 // delete after 3 days (in seconds)
    }
}, {
    timestamps: true
})

const Conversation = mongoose.model("Conversation", conversationSchema)
export default Conversation