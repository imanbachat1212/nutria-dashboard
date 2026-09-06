import { z } from "zod";

// Mirrors addItemSchema in mealplans.validation.js — a template item is authored the same way a
// real plan's item is (day/slot/type + a food or recipe reference + quantity/servings), then run
// through the same computeItemDetails snapshot logic.
const templateItemInput = z.object({
  day: z.number().int().min(0).max(6),
  slot: z.string().min(1),
  type: z.enum(["food", "recipe"]),
  food: z.string().optional(),
  meal: z.string().optional(),
  quantity: z.number().min(0).optional(),
  unit: z.string().optional(),
  // Display-only (prompt-47/49) — see templateItemSchema's measureLabel/measureDescription/
  // measureCount comments. Never used in any gram/macro calculation.
  measureLabel: z.string().nullable().optional(),
  measureDescription: z.string().nullable().optional(),
  measureCount: z.number().nullable().optional(),
  servings: z.number().min(0).optional(),
});

export const listTemplatesSchema = z.object({
  query: z.object({
    // Defaults to excluding archived templates — the wizard/normal management view; pass
    // archived=true to see only retired ones, mirroring clients' own archived filter default.
    archived: z.coerce.boolean().optional(),
  }),
});

export const createTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    tag: z.string().optional(),
    days: z.number().int().min(1).optional(),
    items: z.array(templateItemInput).optional(),
  }),
});

export const updateTemplateSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).optional(),
    tag: z.string().nullable().optional(),
    days: z.number().int().min(1).optional(),
    items: z.array(templateItemInput).optional(),
  }),
});

export const templateParamsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

// Mirrors addItemSchema/removeItemSchema in mealplans.validation.js exactly in shape — a
// template's own item-editor (prompt-41) hits these instead of the real plan's item routes, but
// item authoring/removal itself is identical.
export const addTemplateItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: templateItemInput,
});

// Real MealPlan items have no dedicated update route (quantity changes go through remove +
// re-add via the picker, see plan-item-picker.tsx) — this one's new for templates, allowing
// day/slot/quantity edits in place without losing the item's position. Partial: every field
// optional, merged onto the existing item's current values in the service.
export const updateTemplateItemSchema = z.object({
  params: z.object({ id: z.string().min(1), itemId: z.string().min(1) }),
  body: templateItemInput.partial(),
});

export const removeTemplateItemSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    itemId: z.string().min(1),
  }),
});
