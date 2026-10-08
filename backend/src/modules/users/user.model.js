import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    // Login contact number (prompt-125). Optional: the seeded staff-directory accounts have none,
    // and an invited teammate supplies it later from their own profile if at all.
    phone: { type: String, default: null, trim: true },

    // false = suspended OR removed. Login already refused this; as of prompt-125 so does every
    // authenticated request, because a 7-day JWT issued before a suspension kept working for the
    // rest of its life — suspending someone did nothing until their token expired.
    active: { type: Boolean, default: true },

    // Soft removal (prompt-125). NOT a findByIdAndDelete: appointments.staffId and AuditLog.actor
    // both reference User, and hard-deleting a row would orphan a booking's staff and erase the
    // identity behind every action that person ever took. Set alongside active:false; lists
    // filter on it, and the email stays reserved so the address can't be silently re-registered
    // to a different human.
    removedAt: { type: Date, default: null },

    // Last successful login (set in auth.service.login).
    lastLoginAt: { type: Date, default: null },

    // Last authenticated request, refreshed at most once every LAST_ACTIVE_THROTTLE_MS — see
    // middleware/auth.js. Deliberately coarse: this drives a "last active" column, not a session
    // clock, and a write on every request would turn every read into a read + a write.
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The members list reads active, non-removed users ordered by name.
userSchema.index({ active: 1, removedAt: 1 });

export default mongoose.model("User", userSchema);
