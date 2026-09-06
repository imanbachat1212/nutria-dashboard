import { z } from "zod";

export const createPlanSchema = z.object({
  body: z.object({
    client: z.string().min(1),
    name: z.string().min(1),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    goal: z
      .enum(["weight-loss", "muscle-gain", "maintenance", "clinical"])
      .optional(),
    targetCalories: z.number().min(0).optional(),
    targetProtein: z.number().min(0).optional(),
    targetCarbs: z.number().min(0).optional(),
    targetFat: z.number().min(0).optional(),
    targetFiber: z.number().min(0).optional(),
    // "From template" in the New Meal Plan wizard — present means copy that template's day/item
    // content into the new plan; absent (Blank canvas) means the existing items: [] behavior,
    // unchanged.
    templateId: z.string().optional(),
  }),
});

export const updatePlanSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(["draft", "active", "ended"]).optional(),
    goal: z
      .enum(["weight-loss", "muscle-gain", "maintenance", "clinical"])
      .optional(),
    targetCalories: z.number().min(0).optional(),
    targetProtein: z.number().min(0).optional(),
    targetCarbs: z.number().min(0).optional(),
    targetFat: z.number().min(0).optional(),
    targetFiber: z.number().min(0).optional(),
  }),
});

export const listPlansSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.string().optional(),
    client: z.string().optional(),
  }),
});

// Shared by addItemSchema and updateItemSchema (prompt-48) — mirrors templateItemInput in
// mealplantemplates.validation.js exactly, so a real plan's item routes stay in lockstep with
// the template item routes they're built the same way as.
const itemInput = z.object({
  day: z.number().int().min(0).max(6),
  slot: z.string().min(1),
  type: z.enum(["food", "recipe"]),
  food: z.string().optional(),
  meal: z.string().optional(),
  quantity: z.number().min(0).optional(),
  unit: z.string().optional(),
  // Display-only (prompt-47/49) — see planItemSchema's measureLabel/measureDescription/
  // measureCount comments. Never used in any gram/macro calculation.
  measureLabel: z.string().nullable().optional(),
  measureDescription: z.string().nullable().optional(),
  measureCount: z.number().nullable().optional(),
  servings: z.number().min(0).optional(),
});

export const addItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: itemInput,
});

// New (prompt-48) — a real plan's items previously only supported remove + re-add (see
// removeItemSchema below); this brings the same in-place partial-update capability templates
// already got in prompt-41. Partial: every field optional, merged onto the existing item's
// current values in the service (updateItem), so e.g. a bare quantity change doesn't require
// re-sending day/slot/type/food too — same contract as updateTemplateItemSchema.
export const updateItemSchema = z.object({
  params: z.object({ id: z.string().min(1), itemId: z.string().min(1) }),
  body: itemInput.partial(),
});

export const copyDaySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    fromDay: z.number().int().min(0).max(6),
    toDays: z.array(z.number().int().min(0).max(6)).min(1),
  }),
});

export const copyMealSlotSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    fromDay: z.number().int().min(0).max(6),
    slot: z.string().min(1),
    toDays: z.array(z.number().int().min(0).max(6)).min(1),
  }),
});

// Same-day slot-to-slot copy (prompt-56, drag-and-drop) — a sibling to copyMealSlot above, which
// copies one slot's items to the same slot on other days. This copies one slot's items to a
// different slot on the SAME day instead. fromSlot === toSlot is deliberately allowed (a
// self-drop just appends duplicates of the slot onto itself) rather than rejected, matching the
// append-only, no-special-casing decision in mealplans.service.js's copySlotToSlot.
export const copySlotToSlotSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    day: z.number().int().min(0).max(6),
    fromSlot: z.string().min(1),
    toSlot: z.string().min(1),
  }),
});

export const updateSlotTimeSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    slot: z.string().min(1),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:mm 24h format"),
  }),
});

export const duplicatePlanSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).optional(),
    client: z.string().min(1).optional(),
  }),
});

export const removeItemSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    itemId: z.string().min(1),
  }),
});

export const saveAsTemplateSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1),
    tag: z.string().optional(),
    days: z.number().int().min(1).optional(),
  }),
});
