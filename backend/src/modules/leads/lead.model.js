import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    source: { type: String, enum: ["whatsapp", "instagram", "website", "dashboard", "automation"], default: "whatsapp" },
    notes: { type: String },
    status: { type: String, enum: ["new", "contacted", "converted", "lost"], default: "new" },
  },
  { timestamps: true }
);

export default mongoose.model("Lead", leadSchema);
