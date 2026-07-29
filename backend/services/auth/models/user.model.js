import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    _id: {
        type: String
    },
    firebaseUid: {
        type: String,
        unique: true
    },
    name: String,
    email: String,
    avatar: String,
    plan: {
        type: String,
        default: "Free"
    },
    credits: {
        type: Number,
        default: 100
    },
    totalCredits: {
        type: Number,
        default: 100
    },
    planExpiresAt: {
        type: Date
    }
}, {
    timestamps: true
})

const User = mongoose.model("User", userSchema)
export default User