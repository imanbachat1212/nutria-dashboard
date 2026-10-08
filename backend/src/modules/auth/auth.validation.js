import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  }),
});

// ── Invite acceptance (prompt-125) ──────────────────────────────────────────────────────────

export const inviteTokenSchema = z.object({
  params: z.object({ token: z.string().min(10).max(200) }),
});

export const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().min(10).max(200),
    name: z.string().min(1).max(120),
    // Same floor as createUserSchema. The invite flow is how most accounts will be created, so
    // the two paths must not disagree about what a password is.
    password: z.string().min(8).max(200),
  }),
});
