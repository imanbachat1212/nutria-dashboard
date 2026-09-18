import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import * as ctrl from "./automation.controller.js";
import * as messagesCtrl from "../messages/messages.controller.js";
import { clientContextSchema, foodLookupSchema } from "./automation.validation.js";
import { logMessageSchema } from "../messages/messages.validation.js";

const router = Router();

router.use(authenticate);

// Read side of the WhatsApp coach (prompt-94). Both routes are gated by
// "automation.context.read", a permission held only by the scoped INTAKE_API_KEY — separate
// from "journal.intake" so a read scope and a write scope can be revoked independently, and
// following the same reasoning already written in middleware/auth.js: the key given to an
// outside tool carries the specific things that tool needs, and nothing else.
//
// Neither route is wrapped in auditAction: both are reads, and the automation polls them on
// every inbound message — auditing them would bury the log in noise without recording any
// change to anything.
router.get(
  "/client-context",
  requirePermission("automation.context.read"),
  validate(clientContextSchema),
  ctrl.clientContext,
);

router.get(
  "/food-lookup",
  requirePermission("automation.context.read"),
  validate(foodLookupSchema),
  ctrl.foodLookup,
);

// Inbox logging (prompt-96). Lives under /automation because it is n8n-facing and carries an
// automation-scoped permission, but delegates straight to the messages module's own controller
// — the write path is messages.service.js, not a copy of it.
//
// Its own permission, not journal.intake: logging a message and filing a journal entry are
// different capabilities, and either should be revocable without the other.
router.post(
  "/messages",
  requirePermission("automation.messages.write"),
  validate(logMessageSchema),
  messagesCtrl.logMessage,
);

export default router;
