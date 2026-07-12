import mongoose from "mongoose";

const mealPlanBlockSchema = new mongoose.Schema(
  {
    mealPlan: { type: mongoose.Schema.Types.ObjectId, ref: "MealPlan", required: true },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    mealType: { type: String, enum: ["breakfast", "lunch", "dinner", "snack"] },
    foods: [
      {
        food: { type: mongoose.Schema.Types.ObjectId, ref: "Food" },
        quantity: { type: Number },
        unit: { type: String },
      },
    ],
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("MealPlanBlock", mealPlanBlockSchema);
