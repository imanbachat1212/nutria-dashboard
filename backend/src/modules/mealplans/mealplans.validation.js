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

export const addItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    day: z.number().int().min(0).max(6),
    slot: z.string().min(1),
    type: z.enum(["food", "recipe"]),
    food: z.string().optional(),
    meal: z.string().optional(),
    quantity: z.number().min(0).optional(),
    unit: z.string().optional(),
    servings: z.number().min(0).optional(),
  }),
});

export const copyDaySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    fromDay: z.number().int().min(0).max(6),
    toDays: z.array(z.number().int().min(0).max(6)).min(1),
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
