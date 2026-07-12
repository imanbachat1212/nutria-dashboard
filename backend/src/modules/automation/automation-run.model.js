import mongoose from "mongoose";

const automationRunSchema = new mongoose.Schema(
  {
    automation: { type: mongoose.Schema.Types.ObjectId, ref: "Automation", required: true },
    status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
    input: { type: mongoose.Schema.Types.Mixed },
    output: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("AutomationRun", automationRunSchema);
