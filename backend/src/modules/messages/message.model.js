import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    channel: { type: String, enum: ["whatsapp", "sms", "email"], default: "whatsapp" },
    body: { type: String },
    source: { type: String, enum: ["dashboard", "whatsapp", "automation"], default: "dashboard" },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
