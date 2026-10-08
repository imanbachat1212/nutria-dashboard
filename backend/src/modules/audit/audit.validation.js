import { z } from "zod";

export const listAuditSchema = z.object({
  query: z.object({
    actor: z.string().optional(),
    entity: z.string().max(60).optional(),
    action: z.string().max(60).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    q: z.string().max(200).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
  }),
});
