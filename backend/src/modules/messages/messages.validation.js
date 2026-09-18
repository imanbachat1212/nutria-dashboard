import { z } from "zod";

// Automation-facing: n8n logging one message it saw or sent (prompt-96).
export const logMessageSchema = z.object({
  body: z.object({
    phone: z.string().min(1),
    direction: z.enum(["inbound", "outbound"]),
    body: z.string().max(10000).optional(),
    channel: z.enum(["whatsapp", "sms", "email"]).optional(),
    kind: z.enum(["text", "image", "voice", "plan", "system"]).optional(),
    attachmentLabel: z.string().max(200).optional().nullable(),
    // When the message actually happened, if n8n knows; defaults to now.
    sentAt: z.string().optional(),
  }).refine((b) => (b.body && b.body.trim().length > 0) || b.kind, {
    message: "Provide body, kind, or both",
  }),
});

export const threadParamsSchema = z.object({
  params: z.object({ clientId: z.string().min(1) }),
  query: z.object({ limit: z.coerce.number().int().positive().max(500).default(200) }),
});

export const sendMessageSchema = z.object({
  body: z.object({
    client: z.string().min(1),
    body: z.string().min(1).max(4000),
  }),
});
