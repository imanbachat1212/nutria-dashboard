import mongoose from "mongoose";

// A pending invitation to join the team (prompt-125). The model existed but had no routes and no
// documents; this is the first version anything writes.
const inviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },

    // sha256 of the raw token. The RAW TOKEN IS NEVER STORED — it exists only in the link handed
    // to the inviter and in the email. The previous field was `token: { unique: true }`, i.e. the
    // credential itself in plaintext: anyone with read access to the database, a backup, or a log
    // line containing a document dump could have used it to create an account with whatever role
    // the invite carried. Hashing makes a leaked database useless for that, exactly as it is for
    // passwords. sha256 with no salt is deliberate and sufficient here — unlike a password, the
    // input is 32 bytes of CSPRNG output, so there is nothing to brute-force or rainbow-table.
    tokenHash: { type: String, required: true, index: true },

    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    // Set when an invite is withdrawn, or when a newer invite for the same email supersedes it.
    revokedAt: { type: Date, default: null },
    // When the email was last actually sent, so the UI can say "resent 2 min ago" honestly rather
    // than implying delivery it never attempted.
    lastSentAt: { type: Date, default: null },

    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// The pending-invite list: live invites for one email, newest first.
inviteSchema.index({ email: 1, acceptedAt: 1, revokedAt: 1 });
inviteSchema.index({ createdAt: -1 });

export default mongoose.model("Invite", inviteSchema);
