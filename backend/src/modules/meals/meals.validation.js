import { z } from "zod";

const ingredientSchema = z.object({
  food: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().min(0).optional(),
  unit: z.string().optional(),
});

const photoItemSchema = z.object({
  url: z.string(),
  key: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

// photos[0] is the cover — capped well above what the UI exposes (6) as a sanity bound, not
// a UX limit in itself.
const photosSchema = z.array(photoItemSchema).max(6).optional();

export const createMealSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    nameAr: z.string().optional(),
    category: z.enum(["breakfast", "lunch", "dinner", "snack", "dessert", "drink"]).optional(),
    cuisine: z.enum(["lebanese", "mediterranean", "levantine", "international", "asian", "italian"]).optional(),
    servings: z.number().int().positive().optional(),
    prepTime: z.number().min(0).optional(),
    cookTime: z.number().min(0).optional(),
    icon: z.string().optional(),
    coverHue: z.string().optional(),
    photos: photosSchema,
    dietTags: z.array(z.string()).optional(),
    allergens: z.array(z.string()).optional(),
    ingredients: z.array(ingredientSchema).optional(),
    steps: z.array(z.string()).optional(),
    totalCalories: z.number().min(0).optional(),
    totalProtein: z.number().min(0).optional(),
    totalCarbs: z.number().min(0).optional(),
    totalFat: z.number().min(0).optional(),
    totalFiber: z.number().min(0).optional(),
    verified: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const updateMealSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).optional(),
    nameAr: z.string().optional(),
    category: z.enum(["breakfast", "lunch", "dinner", "snack", "dessert", "drink"]).optional(),
    cuisine: z.enum(["lebanese", "mediterranean", "levantine", "international", "asian", "italian"]).optional(),
    servings: z.number().int().positive().optional(),
    prepTime: z.number().min(0).optional(),
    cookTime: z.number().min(0).optional(),
    icon: z.string().optional(),
    coverHue: z.string().optional(),
    photos: photosSchema,
    dietTags: z.array(z.string()).optional(),
    allergens: z.array(z.string()).optional(),
    ingredients: z.array(ingredientSchema).optional(),
    steps: z.array(z.string()).optional(),
    totalCalories: z.number().min(0).optional(),
    totalProtein: z.number().min(0).optional(),
    totalCarbs: z.number().min(0).optional(),
    totalFat: z.number().min(0).optional(),
    totalFiber: z.number().min(0).optional(),
    verified: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const listMealsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    category: z.string().optional(),
  }),
});
