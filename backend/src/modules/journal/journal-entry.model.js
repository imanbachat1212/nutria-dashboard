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

// One reported activity session, for kind === "exercise" (prompt-95). Null on every meal entry.
//
// Its own sub-document rather than free text in `note`, because burnedCalories has to stay
// queryable: the open question of whether exercise offsets a client's daily target is a
// clinical decision the dietitian hasn't made yet, and a number buried in prose can't be
// switched on later without re-parsing sentences.
//
// Every field except `type` is nullable on purpose. These arrive from an AI estimate over a
// WhatsApp message — "3melt gym lyom" gives a type and nothing else — and a fabricated 45
// minutes would look exactly like a measured one once it's in the chart.
const exerciseSchema = new mongoose.Schema(
  {
    // Free text, not an enum: the vocabulary is whatever a client writes (gym, padel, walking,
    // "zumba class"), and rejecting an unrecognised activity would drop the log entirely.
    type: { type: String, required: true, trim: true },
    minutes: { type: Number, default: null },
    intensity: { type: String, enum: ["light", "moderate", "vigorous", null], default: null },
    // AI-estimated from activity/duration/intensity and the client's weight, on the n8n side.
    // Deliberately NOT subtracted from anything — see automation.service.js's exerciseToday.
    burnedCalories: { type: Number, default: null },
  },
  { _id: false },
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

    // Populated only when kind === "exercise"; null for meals. An exercise entry carries no
    // items and no mealSlot, which is why everything that totals food filters on kind rather
    // than relying on items happening to be empty.
    exercise: { type: exerciseSchema, default: null },

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
