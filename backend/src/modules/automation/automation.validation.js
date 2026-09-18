import { z } from "zod";

export const clientContextSchema = z.object({
  query: z.object({
    // Same input contract as the intake endpoint: any format normalizePhone() accepts.
    phone: z.string().min(1),
  }),
});

export const foodLookupSchema = z.object({
  query: z.object({
    q: z.string().min(2),
    // Small by default — this feeds one food-identification step, not a browse.
    limit: z.coerce.number().int().positive().max(25).default(8),
  }),
});
