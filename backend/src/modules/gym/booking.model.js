import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    dateTime: { type: Date, required: true },
    duration: { type: Number, default: 60 },
    status: { type: String, enum: ["booked", "completed", "cancelled", "no_show"], default: "booked" },
    notes: { type: String },
  },
  { timestamps: true }
);

bookingSchema.index({ dateTime: 1 });
bookingSchema.index({ client: 1 });

export default mongoose.model("Booking", bookingSchema);
