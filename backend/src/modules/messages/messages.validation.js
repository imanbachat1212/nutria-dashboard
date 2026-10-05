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
    // The photo itself, base64-encoded (prompt-123). Optional — a text message sends neither of
    // these and is completely unaffected.
    //
    // Not a multipart upload like the dashboard's /api/media route: this endpoint is called by
    // an n8n HTTP node composing a JSON body, and base64 inside that JSON is the one thing such
    // a node can always produce without a file-handling step. The ~33% encoding overhead is the
    // price, and it is why the body limit for this route is raised (see app.js).
    //
    // A data-URL prefix is tolerated and stripped in the service, since an n8n expression that
    // forwards a browser/API value may well include one.
    imageBase64: z.string().min(1).optional(),
    // Declared separately rather than parsed out of a data URL, so the caller states its intent
    // and a wrong type is a 400 instead of a silently-stored file. The enum IS the whitelist —
    // "reject a wrong mime" needs no service-side check to be a 400.
    //
    // Note this is only the DECLARED type: uploadImage sniffs the real bytes for the stored
    // extension and Content-Type, so a lie here cannot make R2 serve a .jpg that isn't one.
    imageMime: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
    // When the message actually happened, if n8n knows; defaults to now.
    sentAt: z.string().optional(),
  }).refine((b) => (b.body && b.body.trim().length > 0) || b.kind, {
    message: "Provide body, kind, or both",
  }).refine((b) => !b.imageBase64 || !!b.imageMime, {
    // Without a declared type there is nothing to validate the upload against, and guessing
    // from the bytes would mean accepting whatever arrived — the opposite of a whitelist.
    message: "imageMime is required when imageBase64 is provided",
    path: ["imageMime"],
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
