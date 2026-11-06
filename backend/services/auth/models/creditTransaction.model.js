import mongoose from "mongoose";

/**
 * Append-only credit ledger. `key` is the idempotency key: a retried provider
 * call or a repeated agent request can never move credits twice.
 */
const creditTransactionSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    type: {
        type: String,
        required: true,
        enum: ["reserve", "refund", "grant", "revoke", "restore"],
    },
    credits: {
        type: Number,
        required: true,
        min: 0,
    },
    agent: {
        type: String,
        default: null,
    },
    // Only grants carry an orderId; sparse so reserve/refund rows stay unique
    // by key without colliding on a missing field.
    orderId: {
        type: String,
        sparse: true,
        unique: true,
    },
    refundAttemptId: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        required: true,
        enum: ["pending", "applied", "failed"],
        default: "pending",
        index: true,
    },
    detail: {
        type: String,
        default: null,
        maxlength: 500,
    },
}, { timestamps: true })

creditTransactionSchema.index({ userId: 1, createdAt: -1 })

const CreditTransaction = mongoose.model("CreditTransaction", creditTransactionSchema)
export default CreditTransaction
