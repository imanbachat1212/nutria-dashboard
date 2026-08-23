import mongoose from "mongoose";
import { imageSchema } from "../../lib/imageSchema.js";

const labSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed },
    unit: { type: String },
    reference: { type: String },
    date: { type: Date },
  },
  { _id: false }
);

const targetsSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ["auto", "manual"], default: "auto" },
    bmr: { type: Number },
    tee: { type: Number },
    calories: { type: Number },
    protein: { type: Number },
    carbs: { type: Number },
    fat: { type: Number },
    fiber: { type: Number },
  },
  { _id: false }
);

// DRI (Dietary Reference Intake) vitamin/mineral targets — see lib/calc/dri.js for the source
// tables. Mirrors targetsSchema's method/manual pattern exactly: "auto" is recomputed whenever
// age/sex/lifeStage change, "manual" is left untouched by the auto-recompute path. Field names
// match the Food model's micronutrient fields 1:1. Fields not covered by an official DRI
// (amino acids, omega-3/6, oxalate, phytate) are intentionally absent here, not zeroed.
const driTargetsSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ["auto", "manual"], default: "auto" },
    computedAt: { type: Date },
    // Vitamins
    vitaminA: { type: Number },
    vitaminC: { type: Number },
    vitaminD: { type: Number },
    vitaminE: { type: Number },
    vitaminK: { type: Number },
    vitaminB1: { type: Number },
    vitaminB2: { type: Number },
    vitaminB3: { type: Number },
    vitaminB5: { type: Number },
    vitaminB6: { type: Number },
    vitaminB12: { type: Number },
    folate: { type: Number },
    // Minerals
    calcium: { type: Number },
    iron: { type: Number },
    magnesium: { type: Number },
    phosphorus: { type: Number },
    potassium: { type: Number },
    sodium: { type: Number },
    zinc: { type: Number },
    copper: { type: Number },
    manganese: { type: Number },
    selenium: { type: Number },
  },
  { _id: false }
);

const clientSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["lead", "active", "inactive"], default: "lead" },
    serviceType: { type: [{ type: String, enum: ["diet", "gym", "classes"] }], default: [] },
    // Soft-delete flag, orthogonal to `status` — "inactive" status means paused-but-current
    // (still shown in the roster), while `archived` hides a client from the default list
    // entirely without touching status or cascading to their appointments/plans/billing/notes.
    archived: { type: Boolean, default: false, index: true },

    photo: { type: imageSchema, default: null },

    profile: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      dateOfBirth: { type: Date },
      sex: { type: String, enum: ["male", "female"] },
      // Life-stage for DRI purposes (lib/calc/dri.js) — only meaningful when sex is "female";
      // drives whether the pregnancy/lactation DRI tables are used instead of standard female.
      lifeStage: { type: String, enum: ["none", "pregnant", "lactating"], default: "none" },
      height: { type: Number },
      weight: { type: Number },
      startWeight: { type: Number },
      goalWeight: { type: Number },
      activityLevel: {
        type: String,
        enum: ["sedentary", "light", "moderate", "active", "very_active"],
      },
      goal: { type: String, enum: ["lose", "maintain", "gain"] },
      occupation: { type: String, trim: true },
      sleepHours: { type: Number },
      waterIntake: { type: Number },
      dietaryPreferences: [{ type: String }],
      allergies: [{ type: String }],
      intolerances: [{ type: String }],
      foodsToAvoid: [{ type: String }],
    },

    targets: { type: targetsSchema, default: null },
    driTargets: { type: driTargetsSchema, default: null },

    clinical: {
      labs: [labSchema],
      medicalHistory: [{ type: String }],
      nutritionDiagnosis: { type: String },
      monitoring: { type: String },
    },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Client", clientSchema);
