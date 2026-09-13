import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./webhooks.controller.js";
import { whatsappJournalSchema } from "./whatsapp.validation.js";

const router = Router();

router.use(authenticate);

// POST /api/webhooks/whatsapp/journal — n8n posts one inbound WhatsApp message; a pending
// journal entry comes back (prompt-91).
//
// Gated by "journal.intake", a permission held ONLY by the scoped INTAKE_API_KEY (see
// middleware/auth.js). The unrestricted SERVICE_API_KEY still reaches it through the "*"
// wildcard, but the point of the scoped key is that n8n never needs to be given that one.
//
// Audited like every other write: an entry arriving from outside the dashboard is exactly the
// kind of thing worth being able to trace afterwards.
router.post(
  "/whatsapp/journal",
  requirePermission("journal.intake"),
  validate(whatsappJournalSchema),
  auditAction("create", "journal_entry"),
  ctrl.whatsappJournal,
);

export default router;
