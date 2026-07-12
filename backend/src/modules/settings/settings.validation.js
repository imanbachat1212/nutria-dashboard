import { z } from "zod";

export const updateClassTypesSchema = z.object({
  body: z.object({
    classTypes: z.array(z.string().trim().min(1)).min(1, "At least one class type is required"),
  }),
});
