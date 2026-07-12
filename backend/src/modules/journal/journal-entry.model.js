import mongoose from "mongoose";
import { imageSchema } from "../../lib/imageSchema.js";

const macrosSchema = new mongoose.Schema(
  { calories: Number, protein: Number, carbs: Number, fat: Number, fiber: Number },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    food:   { type: mongoose.Schema.Types.ObjectId, ref: "Food", default: null },
    label:  { type: String, required: true },
    grams:  { type: Number, default: null },
    // null when food/grams unknown; computed on create/update when both present
    macros: { type: macrosSchema, default: null },
  },
  { _id: false }
);

const journalEntrySchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    kind: { type: String, enum: ["meal", "exercise"], required: true },

    // meal-only — matches meal-plan slot enum exactly
    mealSlot: {
      type: String,
      enum: ["breakfast", "snack-am", "lunch", "snack-pm", "dinner"],
      default: null,
    },

    // AUTOMATION: whatsapp-text and whatsapp-photo are written by the n8n/Groq
    // pipeline later. Dashboard is the manual dietitian path built now.
    source: {
      type: String,
      enum: ["dashboard", "whatsapp-text", "whatsapp-photo"],
      default: "dashboard",
    },

    items: { type: [itemSchema], default: [] },

    // null for dashboard entries (no AI estimate); set by automation pipeline
    confidence: {
      type: String,
      enum: ["low", "medium", "high", null],
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "edited", "rejected"],
      default: "approved",
    },

    // AUTOMATION: flags written by Groq confidence analysis; always [] for dashboard
    flags: [{ type: String }],

    // AUTOMATION: raw WhatsApp text or "[photo]"; undefined for dashboard entries
    rawMessage: { type: String },

    // AUTOMATION: meal photo uploaded by n8n; null for dashboard entries
    photo: { type: imageSchema, default: null },

    note: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

journalEntrySchema.index({ client: 1, date: -1 });

export default mongoose.model("JournalEntry", journalEntrySchema);
