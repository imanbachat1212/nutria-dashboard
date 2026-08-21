import { z } from "zod";

export const updateClassTypesSchema = z.object({
  body: z.object({
    classTypes: z.array(z.string().trim().min(1)).min(1, "At least one class type is required"),
  }),
});

export const updateDietaryPreferencesSchema = z.object({
  body: z.object({
    dietaryPreferences: z
      .array(z.string().trim().min(1))
      .min(1, "At least one dietary preference is required"),
  }),
});
