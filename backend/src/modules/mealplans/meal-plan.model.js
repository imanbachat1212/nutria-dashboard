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
    items: [planItemSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

mealPlanSchema.index({ client: 1, status: 1 });
mealPlanSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model("MealPlan", mealPlanSchema);
