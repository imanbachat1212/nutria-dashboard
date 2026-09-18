import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./messages.controller.js";
import { threadParamsSchema, sendMessageSchema } from "./messages.validation.js";

const router = Router();

router.use(authenticate);

// Dashboard-authenticated reads, gated by the same messages.* permissions already in seed.js —
// this is Sura looking at her own clients' conversations, not automation. The service key can
// reach these too via its "*" wildcard; the scoped INTAKE_API_KEY deliberately cannot.
router.get("/", requirePermission("messages.read"), ctrl.listConversations);

// Before /:clientId, or Express matches "status" as the param.
router.get("/status", requirePermission("messages.read"), ctrl.getStatus);

router.post(
  "/send",
  requirePermission("messages.create"),
  validate(sendMessageSchema),
  auditAction("create", "message"),
  ctrl.send,
);

router.get(
  "/:clientId",
  requirePermission("messages.read"),
  validate(threadParamsSchema),
  ctrl.getThread,
);

export default router;
