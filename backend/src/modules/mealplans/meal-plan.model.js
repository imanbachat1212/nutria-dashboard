import mongoose from "mongoose";

const planItemSchema = new mongoose.Schema({
  day: { type: Number, min: 0, max: 6, required: true },
  slot: { type: String, required: true },
  type: { type: String, enum: ["food", "recipe"], required: true },
  food: { type: mongoose.Schema.Types.ObjectId, ref: "Food", default: null },
  meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meal", default: null },
  name: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: "g" },
  servings: { type: Number, default: 1 },
  calories: { type: Number, default: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  // DRI-matched micronutrient snapshot — same 22 fields as Food/Client.driTargets (see
  // lib/calc/dri.js), computed once when the item is added (mealplans.service.js
  // computeItemDetails), same denormalized-at-add-time pattern as calories/protein/carbs/fat
  // above. Nullable: null means "no data available for this nutrient", not zero.
  vitaminA: { type: Number, default: null },
  vitaminC: { type: Number, default: null },
  vitaminD: { type: Number, default: null },
  vitaminE: { type: Number, default: null },
  vitaminK: { type: Number, default: null },
  vitaminB1: { type: Number, default: null },
  vitaminB2: { type: Number, default: null },
  vitaminB3: { type: Number, default: null },
  vitaminB5: { type: Number, default: null },
  vitaminB6: { type: Number, default: null },
  vitaminB12: { type: Number, default: null },
  folate: { type: Number, default: null },
  calcium: { type: Number, default: null },
  iron: { type: Number, default: null },
  magnesium: { type: Number, default: null },
  phosphorus: { type: Number, default: null },
  potassium: { type: Number, default: null },
  sodium: { type: Number, default: null },
  zinc: { type: Number, default: null },
  copper: { type: Number, default: null },
  manganese: { type: Number, default: null },
  selenium: { type: Number, default: null },
});

const mealPlanSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["draft", "active", "ended"],
      default: "draft",
    },
    goal: {
      type: String,
      enum: ["weight-loss", "muscle-gain", "maintenance", "clinical"],
      default: "weight-loss",
    },
    targetCalories: { type: Number, default: 0 },
    targetProtein: { type: Number, default: 0 },
    targetCarbs: { type: Number, default: 0 },
    targetFat: { type: Number, default: 0 },
    // Per-slot times for the WHOLE plan (not per-item, not per-day) — e.g. { breakfast: "08:00" }.
    // Sparse on purpose: a slot with no entry here falls back to SLOT_META's hardcoded default
    // on the frontend (mealplans-api.ts), so plans created before this field existed keep
    // displaying correctly with no backfill/migration needed.
    slotTimes: { type: Map, of: String, default: {} },
    items: [planItemSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

mealPlanSchema.index({ client: 1, status: 1 });
mealPlanSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model("MealPlan", mealPlanSchema);
