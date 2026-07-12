import mongoose from "mongoose";

const cmsTranslationSchema = new mongoose.Schema(
  {
    block: { type: mongoose.Schema.Types.ObjectId, ref: "CmsBlock", required: true },
    locale: { type: String, required: true },
    content: { type: String },
  },
  { timestamps: true }
);

cmsTranslationSchema.index({ block: 1, locale: 1 }, { unique: true });

export default mongoose.model("CmsTranslation", cmsTranslationSchema);
