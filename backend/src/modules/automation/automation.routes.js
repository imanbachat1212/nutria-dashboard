import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import * as ctrl from "./automation.controller.js";
import * as messagesCtrl from "../messages/messages.controller.js";
import {
  clientContextSchema,
  foodLookupSchema,
  mealLookupSchema,
  recentMessagesSchema,
} from "./automation.validation.js";
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

// Meal Library lookup (prompt-121). Sits beside /food-lookup rather than in its own module:
// same caller, same scope, same "read the dietitian's data so the AI doesn't invent it" job, and
// it owns no entity of its own. A separate module would be a folder of five files to hold one
// read.
//
// Reuses automation.context.read — NOT a new permission. The scoped INTAKE_API_KEY already
// carries it, so the key n8n is already using works unchanged; minting a third permission for
// another read by the same consumer would mean a seed migration and a key rotation to grant
// n8n something it demonstrably already has.
//
// Unaudited for the same reason as the two reads above: polled per inbound message, changes
// nothing.
router.get(
  "/meal-lookup",
  requirePermission("automation.context.read"),
  validate(mealLookupSchema),
  ctrl.mealLookup,
);

// The last few messages of this client's thread, so a follow-up ("another one", "something
// lighter") can be understood in context instead of as a message out of nowhere. Same permission
// and reasoning as the reads above: reuses automation.context.read, unaudited, changes nothing.
router.get(
  "/recent-messages",
  requirePermission("automation.context.read"),
  validate(recentMessagesSchema),
  ctrl.recentMessages,
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
