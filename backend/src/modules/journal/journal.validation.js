import { z } from "zod";

const itemSchema = z.object({
  food:  z.string().optional().nullable(),
  label: z.string().min(1),
  grams: z.number().min(0).optional().nullable(),
  // automation can supply pre-computed macros; otherwise computed server-side
  macros: z
    .object({
      calories: z.number(),
      protein:  z.number(),
      carbs:    z.number(),
      fat:      z.number(),
      fiber:    z.number().default(0),
    })
    .optional()
    .nullable(),
});

export const createEntrySchema = z.object({
  body: z.object({
    client:     z.string().min(1),
    date:       z.string().min(1),
    kind:       z.enum(["meal", "exercise"]),
    mealSlot:   z.enum(["breakfast", "snack-am", "lunch", "snack-pm", "dinner"]).optional().nullable(),
    source:     z.enum(["dashboard", "whatsapp-text", "whatsapp-photo"]).default("dashboard"),
    items:      z.array(itemSchema).default([]),
    confidence: z.enum(["low", "medium", "high"]).optional().nullable(),
    status:     z.enum(["pending", "approved", "edited", "rejected"]).optional(),
    flags:      z.array(z.string()).default([]),
    rawMessage: z.string().optional(),
    note:       z.string().optional(),
  }),
});

export const updateEntrySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    date:       z.string().optional(),
    kind:       z.enum(["meal", "exercise"]).optional(),
    mealSlot:   z.enum(["breakfast", "snack-am", "lunch", "snack-pm", "dinner"]).optional().nullable(),
    source:     z.enum(["dashboard", "whatsapp-text", "whatsapp-photo"]).optional(),
    items:      z.array(itemSchema).optional(),
    confidence: z.enum(["low", "medium", "high"]).optional().nullable(),
    status:     z.enum(["pending", "approved", "edited", "rejected"]).optional(),
    flags:      z.array(z.string()).optional(),
    note:       z.string().optional(),
  }),
});

export const listEntriesSchema = z.object({
  query: z.object({
    client: z.string().optional(),
    from:   z.string().optional(),
    to:     z.string().optional(),
    kind:   z.enum(["meal", "exercise"]).optional(),
    status: z.enum(["pending", "approved", "edited", "rejected"]).optional(),
    limit:  z.coerce.number().int().positive().max(200).default(100),
  }),
});

export const entryParamsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
