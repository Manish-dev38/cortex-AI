import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    _id: {
        type: String
    },
    firebaseUid: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    name: String,
    email: String,
    avatar: String,
    // Canonical ids: "free" | "starter" | "pro". Legacy rows may still hold
    // display-cased values ("Free"), so reads go through plan.normalizePlanId.
    plan: {
        type: String,
        default: "free"
    },
    credits: {
        type: Number,
        min: 0,
        default: 100
    },
    totalCredits: {
        type: Number,
        min: 0,
        default: 100
    },
    planExpiresAt: {
        type: Date,
        default: null,
    }
}, {
    timestamps: true
})

const User = mongoose.model("User", userSchema)
export default User
