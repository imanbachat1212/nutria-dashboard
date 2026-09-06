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
  // Display-only (prompt-47) — the real per-food measure the dietitian actually picked (e.g.
  // "3 pitted dates"), when one was picked via MeasureSelect. quantity/unit above are always the
  // already-resolved gram total, which is what every calculation (computeItemDetails below,
  // dayMacros/mealMacros on the frontend) reads — this field is never read by any calculation,
  // purely a nicer label for item rows to show instead of a bare gram amount. null/absent for a
  // generic-unit selection (cup/tbsp/tsp/piece/ml/g) or any item added before this field existed.
  measureLabel: { type: String, default: null },
  // Structured counterparts to measureLabel (prompt-49) — see the identical comment on
  // meal.model.js's ingredientSchema.measureDescription/measureCount. Lets an edit-in-place UI
  // (EditPlanItemDialog) re-open pre-selected on the exact real measure originally picked,
  // instead of always falling back to grams. Never read by any calculation.
  measureDescription: { type: String, default: null },
  measureCount: { type: Number, default: null },
  servings: { type: Number, default: 1 },
  calories: { type: Number, default: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  fiber: { type: Number, default: 0 },
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
    targetFiber: { type: Number, default: 0 },
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
