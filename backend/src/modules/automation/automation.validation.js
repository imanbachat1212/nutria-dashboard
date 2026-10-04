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
    // Free text the client has already been shown (the coach's earlier replies in this chat).
    // Any recipe whose name appears in it is skipped BEFORE ranking and the limit are applied, so
    // "another suggestion" gets the next-best unseen recipe instead of an already-used top page.
    // Free text rather than a name list because n8n only has the sent messages, not recipe names.
    seen: z.string().max(3000).optional(),
  }),
});

export const recentMessagesSchema = z.object({
  query: z.object({
    phone: z.string().min(1),
    // A short tail of the thread, not the whole inbox: this feeds the model's sense of "what did
    // we just talk about", so "another suggestion" can mean something.
    limit: z.coerce.number().int().positive().max(12).default(6),
    // Only messages from before this instant. n8n passes the moment the CURRENT message arrived,
    // because the inbound log runs in parallel with the AI pipeline and would otherwise hand the
    // model the very message it is about to answer as if it were history.
    before: z.string().datetime({ offset: true }).optional(),
    // Old context is worse than none: "another one" three days later is not a follow-up.
    sinceHours: z.coerce.number().positive().max(72).default(6),
  }),
});
