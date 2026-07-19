import mongoose from "mongoose";
import { imageSchema } from "../../lib/imageSchema.js";

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, trim: true },
    brand: { type: String, trim: true },
    category: { type: String, trim: true, index: true },
    source: {
      type: String,
      enum: ["usda", "lebanese", "custom"],
      default: "custom",
      index: true,
    },
    servingSize: { type: Number, required: true },
    servingUnit: { type: String, required: true, default: "g" },
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    fiber: { type: Number, default: 0 },
    sugar: { type: Number, default: null },
    sodium: { type: Number, default: null },
    verified: { type: Boolean, default: false },
    image: { type: imageSchema, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // USDA FoodData Central id — set only on foods imported via usda-import. sparse lets every
    // non-USDA food omit it; unique (among documents that do have it) prevents importing the
    // same fdcId twice.
    fdcId: { type: Number, index: true, sparse: true, unique: true },
  },
  { timestamps: true }
);

foodSchema.index({ name: "text", nameAr: "text" });

export default mongoose.model("Food", foodSchema);
