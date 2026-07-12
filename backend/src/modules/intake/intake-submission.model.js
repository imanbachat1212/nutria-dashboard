import mongoose from "mongoose";

const intakeSubmissionSchema = new mongoose.Schema(
  {
    form: { type: mongoose.Schema.Types.ObjectId, ref: "IntakeForm", required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    answers: { type: mongoose.Schema.Types.Mixed },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("IntakeSubmission", intakeSubmissionSchema);
