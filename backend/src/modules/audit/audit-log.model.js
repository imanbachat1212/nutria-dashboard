import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String },
    // The client that performed the action (prompt-125). Capped at 300 chars by the middleware —
    // it is attacker-controlled free text that gets rendered in the Audit tab.
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ createdAt: -1 });
// The audit endpoint's filters (prompt-125): action and entity are the two equality filters it
// offers, newest-first within each.
auditLogSchema.index({ entity: 1, action: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
