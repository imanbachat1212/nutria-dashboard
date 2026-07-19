import { z } from "zod";

export const createFoodSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    nameAr: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    source: z.enum(["usda", "lebanese", "custom"]).optional(),
    servingSize: z.number().positive(),
    servingUnit: z.string().default("g"),
    calories: z.number().min(0),
    protein: z.number().min(0),
    carbs: z.number().min(0),
    fat: z.number().min(0),
    fiber: z.number().min(0).optional(),
    sugar: z.number().min(0).nullable().optional(),
    sodium: z.number().min(0).nullable().optional(),
  }),
});

export const updateFoodSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).optional(),
    nameAr: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    source: z.enum(["usda", "lebanese", "custom"]).optional(),
    servingSize: z.number().positive().optional(),
    servingUnit: z.string().optional(),
    calories: z.number().min(0).optional(),
    protein: z.number().min(0).optional(),
    carbs: z.number().min(0).optional(),
    fat: z.number().min(0).optional(),
    fiber: z.number().min(0).optional(),
    sugar: z.number().min(0).nullable().optional(),
    sodium: z.number().min(0).nullable().optional(),
    verified: z.boolean().optional(),
  }),
});

export const listFoodsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    category: z.string().optional(),
    source: z.enum(["usda", "lebanese", "custom"]).optional(),
  }),
});

export const usdaSearchSchema = z.object({
  query: z.object({
    q: z.string().min(1),
  }),
});

export const usdaImportedSchema = z.object({
  query: z.object({
    // comma-separated fdcIds, e.g. "1234,5678" — parsed to numbers in the controller
    fdcIds: z.string().min(1),
  }),
});

export const usdaImportSchema = z.object({
  body: z.object({
    fdcId: z.number().int().positive(),
  }),
});
