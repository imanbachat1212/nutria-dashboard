import mongoose from "mongoose";

const intakeFormSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    fields: [{ type: mongoose.Schema.Types.Mixed }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("IntakeForm", intakeFormSchema);
