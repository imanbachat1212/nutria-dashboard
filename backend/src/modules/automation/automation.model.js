import mongoose from "mongoose";

const automationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    trigger: { type: String },
    actions: [{ type: mongoose.Schema.Types.Mixed }],
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Automation", automationSchema);
