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

const clientSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["lead", "active", "inactive"], default: "lead" },
    serviceType: { type: [{ type: String, enum: ["diet", "gym", "classes"] }], default: [] },

    photo: { type: imageSchema, default: null },

    profile: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      dateOfBirth: { type: Date },
      sex: { type: String, enum: ["male", "female"] },
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
