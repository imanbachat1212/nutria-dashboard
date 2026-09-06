import mongoose from "mongoose";

// Deliberately identical in shape to planItemSchema in meal-plan.model.js — day/slot/type +
// an optional food/meal reference alongside a denormalized snapshot (name/calories/macros/
// micros) computed once when the item is added. That snapshot is the actual source of truth
// this app already reads from everywhere (see mealplans-api.ts's buildDays, which reads
// i.name/i.calories directly, never the populated food/meal), so a template survives its
// referenced Food/Meal being edited or deleted later — same as a real plan already does. Kept
// as a second identical schema (not imported from meal-plan.model.js) since that file is a
// different module's model and Mongoose sub-schemas aren't meant to be shared/imported directly
// across modules; the shapes are kept in sync by convention/comment, not by reference.
const templateItemSchema = new mongoose.Schema({
  day: { type: Number, min: 0, max: 6, required: true },
  slot: { type: String, required: true },
  type: { type: String, enum: ["food", "recipe"], required: true },
  food: { type: mongoose.Schema.Types.ObjectId, ref: "Food", default: null },
  meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meal", default: null },
  name: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: "g" },
  // Display-only (prompt-47) — mirrors planItemSchema's own measureLabel exactly (see
  // meal-plan.model.js): the real per-food measure picked via MeasureSelect, never read by any
  // calculation, null/absent for a generic-unit selection or any item added before this field.
  measureLabel: { type: String, default: null },
  // Structured counterparts to measureLabel (prompt-49) — mirrors planItemSchema's own
  // measureDescription/measureCount exactly. Note: the template editor has no per-item
  // edit-in-place UI yet (only add + remove), so these are stored for schema/data consistency
  // with real plan items but have nothing to pre-select in today's UI — see prompt-49's report.
  measureDescription: { type: String, default: null },
  measureCount: { type: Number, default: null },
  servings: { type: Number, default: 1 },
  calories: { type: Number, default: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
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

const mealPlanTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Free text, not MealPlan.goal's fixed enum — the original 6 template tags ("Recomp",
    // "Plant-based", "Seasonal") don't fit that enum's 4 values, and a template category is a
    // looser, more marketing-facing label than a client's actual goal.
    tag: { type: String, trim: true, default: null },
    // Advertised/intended plan duration (e.g. 30 for a Ramadan-length plan) — purely
    // informational for the wizard/management list. The actual authored content below always
    // cycles a single 7-day (day 0-6) week, exactly like a real MealPlan's items — a longer
    // "days" duration means that same week repeats for longer once copied into a plan, not that
    // 30 distinct days of content are authored here.
    days: { type: Number, min: 1, default: 7 },
    items: [templateItemSchema],
    // Archived (not hard-deleted) so a template used to build past plans can be retired from
    // the wizard's picker without touching those already-created plans — same pattern as
    // Client.archived.
    archived: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

mealPlanTemplateSchema.index({ archived: 1, updatedAt: -1 });

export default mongoose.model("MealPlanTemplate", mealPlanTemplateSchema);
