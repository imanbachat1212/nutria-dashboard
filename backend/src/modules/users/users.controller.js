import { asyncHandler } from "../../lib/asyncHandler.js";
import * as usersService from "./users.service.js";
import * as invitesService from "./invites.service.js";
import * as rolesService from "./roles.service.js";
import { recordAudit } from "../../middleware/audit.js";

export const create = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.validated.body);
  res.status(201).json({ data: user });
});

export const list = asyncHandler(async (req, res) => {
  const result = await usersService.listUsers(req.validated.query);
  res.json({ data: result });
});

export const getOne = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(req.params.id);
  res.json({ data: user });
});

// Audited by hand rather than with auditAction, so the log says what actually happened —
// "role changed", "suspended", "reactivated" — instead of one undifferentiated "update user".
// A readable action name is the whole point of the Audit tab.
export const update = asyncHandler(async (req, res) => {
  const before = await usersService.getUserById(req.params.id);
  const user = await usersService.updateUser(req.params.id, req.validated.body, req.user);

  const actions = [];
  if (req.validated.body.role != null && String(before.role?._id) !== String(req.validated.body.role)) {
    actions.push("role changed");
  }
  if (req.validated.body.active === false && before.active !== false) actions.push("suspended");
  if (req.validated.body.active === true && before.active === false) actions.push("reactivated");
  if (!actions.length) actions.push("updated");

  for (const action of actions) {
    await recordAudit(req, {
      action,
      entity: "user",
      entityId: user.id,
      before: { name: before.name, email: before.email, role: before.role?.name, active: before.active },
      after: { name: user.name, email: user.email, role: user.role?.name, active: user.status === "active" },
    });
  }
  res.json({ data: user });
});

export const remove = asyncHandler(async (req, res) => {
  const before = await usersService.getUserById(req.params.id);
  const user = await usersService.removeUser(req.params.id, req.user);
  await recordAudit(req, {
    action: "removed",
    entity: "user",
    entityId: user.id,
    before: { name: before.name, email: before.email, role: before.role?.name, active: before.active },
    after: { active: false, removedAt: new Date() },
  });
  res.json({ data: user });
});

// ── Invites ─────────────────────────────────────────────────────────────────────────────────
// Audited by hand throughout: auditAction would log `body.data`, which for these routes contains
// the accept link. The middleware redacts it anyway (see middleware/audit.js), but recording the
// email and role explicitly is both safer and more readable than a redacted blob.

export const createInvite = asyncHandler(async (req, res) => {
  const result = await invitesService.createInvite(req.validated.body, req.user);
  await recordAudit(req, {
    action: "invite created",
    entity: "invite",
    entityId: result.invite.id,
    after: { email: result.invite.email, role: result.invite.role?.name, emailSent: result.emailSent },
  });
  res.status(201).json({ data: result });
});

export const listInvites = asyncHandler(async (_req, res) => {
  res.json({ data: await invitesService.listInvites() });
});

export const resendInvite = asyncHandler(async (req, res) => {
  const result = await invitesService.resendInvite(req.params.id, req.user);
  await recordAudit(req, {
    action: "invite resent",
    entity: "invite",
    entityId: result.invite.id,
    after: { email: result.invite.email, role: result.invite.role?.name, emailSent: result.emailSent },
  });
  res.json({ data: result });
});

export const revokeInvite = asyncHandler(async (req, res) => {
  const invite = await invitesService.revokeInvite(req.params.id);
  await recordAudit(req, {
    action: "invite revoked",
    entity: "invite",
    entityId: invite.id,
    after: { email: invite.email, role: invite.role?.name },
  });
  res.json({ data: invite });
});

// ── Roles ───────────────────────────────────────────────────────────────────────────────────

export const listRoles = asyncHandler(async (_req, res) => {
  res.json({ data: await rolesService.listRoles() });
});

export const updateRole = asyncHandler(async (req, res) => {
  const before = await rolesService.listRoles();
  const prev = before.roles.find((r) => r.id === req.params.id);
  const role = await rolesService.updateRolePermissions(req.params.id, req.validated.body.permissions);
  await recordAudit(req, {
    action: "role permissions changed",
    entity: "role",
    entityId: role.id,
    before: { name: prev?.name, permissions: prev?.permissions },
    after: { name: role.name, permissions: role.permissions },
  });
  res.json({ data: role });
});
