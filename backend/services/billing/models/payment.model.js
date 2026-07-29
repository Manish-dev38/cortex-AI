import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 128,
        index: true,
    },
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    paymentId: {
        type: String,
        default: null,
        unique: true,
        sparse: true,
        index: true,
    },
    idempotencyKey: {
        type: String,
        default: null,
        maxlength: 64,
        index: true,
    },
    receipt: {
        type: String,
        required: true,
        unique: true,
    },
    plan: {
        type: String,
        required: true,
        enum: ["free", "starter", "pro"],
    },
    // Credits are always set explicitly from the server-side plan catalogue.
    // No default is provided so an undefined value fails validation loudly
    // instead of silently becoming 100.
    credits: {
        type: Number,
        required: true,
        min: 0,
        max: 1000000,
    },
    totalCredits: {
        type: Number,
        required: true,
        min: 0,
        max: 10000000,
    },
    // Itemised pricing snapshot in rupees, plus the exact paise figure sent
    // to the provider, so audits can reconcile without unit confusion.
    amountSubtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    proratedCredit: { type: Number, required: true, min: 0, default: 0 },
    taxAmount: { type: Number, required: true, min: 0, default: 0 },
    amountTotal: { type: Number, required: true, min: 0 },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: {
        type: String,
        required: true,
        enum: ["INR"],
        default: "INR",
    },
    status: {
        type: String,
        required: true,
        enum: [
            "created",
            "paid",
            "failed",
            "expired",
            "refunded",
            "partially_refunded",
            "disputed",
            "cancelled",
        ],
        default: "created",
        index: true,
    },
    creditStatus: {
        type: String,
        required: true,
        // "crediting" is a transient single-flight guard: at most one worker
        // (verify vs webhook retry) may propagate the credit downstream.
        enum: ["pending", "crediting", "applied", "failed", "not_required"],
        default: "pending",
    },
    invoiceId: {
        type: String,
        default: null,
        unique: true,
        sparse: true,
    },
    invoice: {
        id: String,
        subtotal: Number,
        discount: Number,
        proratedCredit: Number,
        tax: Number,
        total: Number,
        currency: String,
        issuedAt: Date,
    },
    planExpiresAt: {
        type: Date,
        default: null,
    },
    // Only pending ("created") records carry expiresAt, so the TTL index
    // reaps abandoned checkouts without touching settled history.
    expiresAt: {
        type: Date,
        default: null,
        index: true,
    },
    failureReason: { type: String, default: null, maxlength: 500 },
    refundId: { type: String, default: null },
    refundAmount: { type: Number, default: 0, min: 0 },
    disputeId: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    webhookEventIds: { type: [String], default: [] },
}, { timestamps: true })

paymentSchema.index({ userId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, idempotencyKey: 1 }, { sparse: true });
paymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Payment = mongoose.model("Payment", paymentSchema)
export default Payment
