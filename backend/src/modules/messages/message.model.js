import mongoose from "mongoose";

// One WhatsApp (or SMS/email) message, inbound or outbound (prompt-96).
//
// A message and a journal entry are different things, and this model exists so they stop being
// conflated: a greeting, an off-topic question, or anything n8n's "no food to log" gate
// correctly skips still happened, and still belongs in the dietitian's inbox. Every message is
// logged here regardless of whether it produced a journal entry.
//
// There is no "lead" variant of this document. A lead in this codebase is a Client with
// `status: "lead"` — the Lead model carries `client`, `source`, `notes` and `status` and has no
// phone of its own, so it annotates a Client rather than replacing one. The inbox derives a
// conversation's client/lead kind from `client.status`, which is why `client` can stay required.
const messageSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    channel: { type: String, enum: ["whatsapp", "sms", "email"], default: "whatsapp" },
    body: { type: String },

    // What WhatsApp actually delivered. Only n8n can know this — by the time a message reaches
    // the backend it is JSON either way — so it is stored rather than inferred. "plan" and
    // "system" are for outbound sends the dashboard will produce later; nothing writes them yet.
    kind: {
      type: String,
      enum: ["text", "image", "voice", "plan", "system"],
      default: "text",
    },
    // Filename or short descriptor for a non-text message ("lunch.jpg"), so the inbox can show
    // something meaningful without the media itself. The media lives wherever n8n put it; this
    // is a label, not a URL.
    attachmentLabel: { type: String, default: null },

    source: { type: String, enum: ["dashboard", "whatsapp", "automation"], default: "dashboard" },

    // Outbound delivery state only; null on every inbound message, which was delivered by
    // definition. "queued" is the moment before the n8n call resolves, "failed" is what the
    // dietitian sees when that call didn't go through — the message is still written either way,
    // so nothing she typed is lost.
    //
    // Deliberately NOT "delivered"/"read": those need WhatsApp delivery receipts flowing back
    // through n8n, which doesn't send them today. Inventing the states would put ticks in the UI
    // that mean nothing.
    status: {
      type: String,
      enum: ["queued", "sent", "failed", null],
      default: null,
    },
    error: { type: String, default: null },

    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Thread reads and the conversation list both walk newest-first within one client.
messageSchema.index({ client: 1, sentAt: -1 });
// "has anything arrived recently" for the inbox's connection indicator.
messageSchema.index({ sentAt: -1 });

export default mongoose.model("Message", messageSchema);
