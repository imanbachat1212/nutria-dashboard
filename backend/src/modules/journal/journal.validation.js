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

// Activity on an exercise entry (prompt-95). Optional everywhere: meals never carry it, and
// the dashboard's own entry dialog doesn't collect it yet — it's here so an estimate that
// arrived from WhatsApp can be corrected through the normal update path rather than needing a
// second endpoint.
const exerciseSchema = z.object({
  type: z.string().min(1),
  minutes: z.number().positive().max(1440).optional().nullable(),
  intensity: z.enum(["light", "moderate", "vigorous"]).optional().nullable(),
  burnedCalories: z.number().min(0).max(10000).optional().nullable(),
});

export const createEntrySchema = z.object({
  body: z.object({
    client:     z.string().min(1),
    date:       z.string().min(1),
    kind:       z.enum(["meal", "exercise"]),
    mealSlot:   z.enum(["breakfast", "snack-am", "lunch", "snack-pm", "dinner"]).optional().nullable(),
    source:     z.enum(["dashboard", "whatsapp-text", "whatsapp-photo"]).default("dashboard"),
    items:      z.array(itemSchema).default([]),
    exercise:   exerciseSchema.optional().nullable(),
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
    exercise:   exerciseSchema.optional().nullable(),
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

// Review queue (prompt-124). Same date contract as listEntriesSchema above — deliberately the
// same loose z.string(), parsed by `new Date()` in the service, so the two endpoints accept
// exactly the same inputs and the page can pass one `from` to both.
//
// No `limit`: this returns one row per CLIENT, not per entry, which is what makes it immune to
// the 200-row truncation it exists to fix. Capping it would reintroduce the same bug one level up.
export const listQueueSchema = z.object({
  query: z.object({
    from:   z.string().optional(),
    to:     z.string().optional(),
    // Defaults to the queue's actual job: what still needs review. The other statuses are
    // reachable for symmetry with listEntries, not because the page uses them.
    // "all" = every status, so the page's All tab (and its tab counts) can list every client
    // instead of only those with something pending.
    status: z.enum(["pending", "approved", "edited", "rejected", "all"]).default("pending"),
    // Client-name search. Matched against the joined first/last name in the service.
    q:      z.string().max(200).optional(),
  }),
});

export const entryParamsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
