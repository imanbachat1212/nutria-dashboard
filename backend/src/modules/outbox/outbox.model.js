import mongoose from "mongoose";

const outboxSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["whatsapp", "sms", "email"], required: true },
    recipient: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    sentAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true }
);

outboxSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("Outbox", outboxSchema);
