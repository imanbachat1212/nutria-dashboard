import { z } from "zod";

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
    role: z.string().min(1),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).optional(),
    // Added prompt-125 so the Team page can maintain a contact number.
    phone: z.string().max(40).nullish(),
    role: z.string().min(1).optional(),
    active: z.boolean().optional(),
  }),
});

// ── Team & Access (prompt-125) ──────────────────────────────────────────────────────────────

export const createInviteSchema = z.object({
  body: z.object({
    email: z.string().email(),
    role: z.string().min(1),
  }),
});

export const inviteParamsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const updateRoleSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    // Validated against the real registry in roles.service — an unknown or machine-only key is a
    // 400 with the offending keys named, rather than being silently stored.
    permissions: z.array(z.string()).max(200),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(200),
  }),
});
