import mongoose from "mongoose";
import { imageSchema } from "../../lib/imageSchema.js";

const cmsBlockSchema = new mongoose.Schema(
  {
    page: { type: mongoose.Schema.Types.ObjectId, ref: "CmsPage", required: true },
    type: { type: String, enum: ["text", "image", "video", "html"], default: "text" },
    content: { type: String },
    image: { type: imageSchema, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("CmsBlock", cmsBlockSchema);
