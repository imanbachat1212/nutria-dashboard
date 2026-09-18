import { z } from "zod";

// Payload n8n posts for one inbound WhatsApp message (prompt-91).
//
// `phone` is the only required field, plus at least one of message/photoUrl — a payload with
// neither carries nothing to review, and silently creating an empty pending entry would just
// add noise to the dietitian's queue.
//
// The optional confidence/flags/items exist so the same endpoint still works once a Groq (or
// any other) parsing step is added in front of it: n8n can post the raw message today and
// start attaching parsed items later without a second endpoint. Nothing here computes macros —
// journal.service.js's own enrichItems does that when an item names a food and grams.
export const whatsappJournalSchema = z.object({
  body: z
    .object({
      // Sender's number. Run through the same normalizePhone() used when a client's phone is
      // stored, so "+961 70 256 769" and "+96170256769" both match — see whatsapp.service.js.
      phone: z.string().min(1),
      message: z.string().optional(),
      photoUrl: z.string().url().optional(),
      // Presence of this object is what makes the entry an exercise log rather than a meal
      // (prompt-95) — n8n already classifies intent, so the shape of the payload carries the
      // decision instead of a separate `kind` flag n8n could set inconsistently with the
      // fields it sends. A payload without it behaves exactly as it did before.
      exercise: z
        .object({
          type: z.string().min(1),
          minutes: z.number().positive().max(1440).optional().nullable(),
          intensity: z.enum(["light", "moderate", "vigorous"]).optional().nullable(),
          // The AI's estimate. Capped at a figure no real single session reaches, so a
          // misplaced decimal can't land a five-digit burn in the client's chart.
          burnedCalories: z.number().min(0).max(10000).optional().nullable(),
        })
        .optional(),
      // When the message was sent, if n8n knows it; defaults to now. Accepts any string Date
      // can parse (ISO is what n8n emits).
      date: z.string().optional(),
      mealSlot: z.enum(["breakfast", "snack-am", "lunch", "snack-pm", "dinner"]).optional(),
      confidence: z.enum(["low", "medium", "high"]).optional(),
      flags: z.array(z.string()).optional(),
      items: z
        .array(
          z.object({
            food: z.string().optional().nullable(),
            label: z.string().min(1),
            grams: z.number().min(0).optional().nullable(),
            macros: z
              .object({
                calories: z.number(),
                protein: z.number(),
                carbs: z.number(),
                fat: z.number(),
                fiber: z.number().default(0),
              })
              .optional()
              .nullable(),
          }),
        )
        .optional(),
    })
    .refine((b) => (b.message && b.message.trim().length > 0) || b.photoUrl || b.exercise, {
      message: "Provide message, photoUrl, or exercise",
    }),
});
