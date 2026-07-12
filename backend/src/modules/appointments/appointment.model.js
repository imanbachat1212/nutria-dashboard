import mongoose from "mongoose";

const attendeeSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    name: { type: String, required: true }, // denormalized for display
    status: {
      type: String,
      enum: ["booked", "waitlist", "checked-in", "no-show", "cancelled"],
      default: "booked",
    },
    source: {
      type: String,
      enum: ["dashboard", "whatsapp", "instagram", "web"],
      default: "dashboard",
    },
    bookedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const appointmentSchema = new mongoose.Schema(
  {
    // 1:1 types (diet consults, try-out) — required; unused for the capacity types
    // (gym-class, gym-machine), which use attendees[] instead
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
      required: function () {
        return this.type !== "gym-class" && this.type !== "gym-machine";
      },
    },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["consult-initial", "consult-followup", "try-out", "assessment", "gym-machine", "gym-class"],
      required: true,
    },
    // derived from type at write time (service layer) for fixed-category types; for
    // flexible types (try-out) the caller supplies it based on which staff pool was picked
    category: { type: String, enum: ["diet", "gym"], required: true },
    // capacity-type title (e.g. "HIIT", "Morning Yoga", "Rowing machines"); unused for
    // 1:1 types, which display the client's name instead
    name: { type: String, trim: true },
    status: {
      type: String,
      enum: ["confirmed", "pending", "completed", "no-show", "cancelled"],
      default: "confirmed",
    },
    dateTime: { type: Date, required: true },
    durationMin: { type: Number, default: 30 },
    room: { type: String },
    notes: { type: String },

    // capacity types only (gym-class, gym-machine)
    capacity: { type: Number, default: 8 },
    attendees: { type: [attendeeSchema], default: [] },
  },
  { timestamps: true }
);

appointmentSchema.index({ dateTime: 1 });
appointmentSchema.index({ client: 1 });
appointmentSchema.index({ category: 1, dateTime: 1 });
appointmentSchema.index({ staffId: 1, dateTime: 1 });

export default mongoose.model("Appointment", appointmentSchema);
