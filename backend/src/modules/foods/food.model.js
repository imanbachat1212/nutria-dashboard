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
    // Micronutrients — optional/nullable, same pattern as sugar/sodium. Currently only
    // populated on the Hoteit et al. lab-verified Lebanese dishes/sweets (source: "lebanese",
    // verified: true); every other food leaves them null.
    //
    // ⚠️ UNIT CAVEAT — NOT unit-verified. The source tables (Hoteit et al.) did not explicitly
    // label vitamin units. The stored numbers are the RAW values as published — likely mcg for
    // vitamin A and mcg for vitamin D, mg for vitamin E/C, but this is NOT confirmed. These
    // must be verified against the original papers (F1000Research 2020 / Nutrients 2021 /
    // PLOS One 2024) before use in any clinical calculation involving vitamin dosing.
    // See TODO.md → "Food micronutrient unit verification".
    vitaminA: { type: Number, default: null },
    vitaminD: { type: Number, default: null },
    vitaminE: { type: Number, default: null },
    vitaminC: { type: Number, default: null },
    iron: { type: Number, default: null },
    // Provenance/citation for the numbers on this food (e.g. "Hoteit et al., lab-analyzed").
    // Absent on hand-estimated and USDA-imported foods.
    dataSource: { type: String, trim: true, default: null },
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
