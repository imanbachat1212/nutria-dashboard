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

export const mealLookupSchema = z.object({
  query: z.object({
    // Same input contract as the two routes above: any format normalizePhone() accepts.
    phone: z.string().min(1),
    // The client's own words, straight off WhatsApp ("something light for dinner"). Capped so a
    // pasted essay can't turn into a 400-token regex query — see tokenize() in the service,
    // which also caps the token count it will actually search on.
    q: z.string().min(2).max(200),
    // Feeds ONE chat reply, so the ceiling is deliberately much lower than food-lookup's 25:
    // a WhatsApp message listing five full recipes is not a message anyone reads.
    limit: z.coerce.number().int().positive().max(5).default(3),
  }),
});
