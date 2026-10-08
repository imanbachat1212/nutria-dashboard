import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { auditAction } from "../../middleware/audit.js";
import * as ctrl from "./users.controller.js";
import {
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
  createInviteSchema,
  inviteParamsSchema,
} from "./users.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requirePermission("users.create"),
  validate(createUserSchema),
  auditAction("create", "user"),
  ctrl.create
);

router.get(
  "/",
  requirePermission("users.read"),
  validate(listUsersSchema),
  ctrl.list
);

// ── Invites (prompt-125) ────────────────────────────────────────────────────────────────────
//
// REGISTERED BEFORE "/:id". Express matches in declaration order, so with these below it, a GET
// of /api/users/invites would bind id="invites" and be answered by getUserById — a 404 for a
// route that exists. The same trap the journal queue endpoint had.
//
// Not wrapped in auditAction: these responses carry the accept link, and the controller records
// a purpose-built row (email + role + whether the mail went out) instead.
router.post(
  "/invites",
  requirePermission("users.create"),
  validate(createInviteSchema),
  ctrl.createInvite
);

router.get(
  "/invites",
  requirePermission("users.read"),
  ctrl.listInvites
);

router.post(
  "/invites/:id/resend",
  requirePermission("users.update"),
  validate(inviteParamsSchema),
  ctrl.resendInvite
);

router.delete(
  "/invites/:id",
  requirePermission("users.update"),
  validate(inviteParamsSchema),
  ctrl.revokeInvite
);

router.get(
  "/:id",
  requirePermission("users.read"),
  ctrl.getOne
);

// PATCH and DELETE audit themselves in the controller, so the log reads "role changed" /
// "suspended" / "removed" rather than a generic "update user" — see users.controller.js.
router.patch(
  "/:id",
  requirePermission("users.update"),
  validate(updateUserSchema),
  ctrl.update
);

// Soft remove. Still users.delete, and still DELETE — the caller's intent is "remove this person
// from the team"; that it is implemented as active:false + removedAt is this module's business.
// Returns the updated member (200) rather than 204 so the UI can show the new state.
router.delete(
  "/:id",
  requirePermission("users.delete"),
  ctrl.remove
);

export default router;
