import mongoose from "mongoose";

// One document per provider webhook delivery. eventId is unique so replayed
// or redelivered events are acknowledged without double processing.
const webhookEventSchema = new mongoose.Schema(
    {
        eventId: { type: String, required: true, unique: true, index: true },
        type: { type: String, required: true, maxlength: 120 },
        orderId: { type: String, default: null, index: true },
        paymentId: { type: String, default: null, index: true },
        status: {
            type: String,
            required: true,
            enum: ["processed", "ignored", "deferred", "failed"],
            default: "processed",
        },
        detail: { type: String, default: null, maxlength: 500 },
    },
    { timestamps: true }
);

const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);
export default WebhookEvent;
