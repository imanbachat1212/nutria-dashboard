import Role from "./role.model.js";
import User from "./user.model.js";
import { ApiError } from "../../lib/ApiError.js";
import {
  ASSIGNABLE_PERMISSIONS,
  MACHINE_ONLY_PERMISSIONS,
  OWNER_ROLE,
  PERMISSION_GROUPS,
  roleDefinition,
} from "./role-definitions.js";

/**
 * Every role plus the permission registry the UI builds its matrix from.
 *
 * The registry is returned rather than hardcoded in the frontend so the matrix can never offer a
 * key the backend doesn't know — which is exactly what the old Team page did, with eleven invented
 * keys (clients.view, plans.publish, …) that existed nowhere in this codebase and therefore
 * granted nothing no matter what was ticked.
 */
export async function listRoles() {
  const roles = await Role.find().sort({ name: 1 }).lean();
  const counts = await User.aggregate([
    { $match: { removedAt: null } },
    { $group: { _id: "$role", n: { $sum: 1 } } },
  ]);
  const byRole = new Map(counts.map((c) => [String(c._id), c.n]));

  return {
    roles: roles.map((r) => {
      const def = roleDefinition(r.name);
      return {
        id: String(r._id),
        name: r.name,
        label: def?.label ?? r.name,
        description: def?.description ?? null,
        permissions: r.permissions ?? [],
        memberCount: byRole.get(String(r._id)) ?? 0,
        // The owner role is shown read-only. An owner who could untick users.update on their own
        // role would be one click from an install nobody can administer.
        editable: r.name !== OWNER_ROLE,
        // A role not in role-definitions.js is a leftover (the retired "assistant"). Surfaced so
        // the UI can label it rather than silently presenting it as a first-class role.
        legacy: !def,
      };
    }),
    // Drives the matrix: rows are these groups, columns are read/create/update/delete.
    permissionGroups: PERMISSION_GROUPS,
    assignablePermissions: ASSIGNABLE_PERMISSIONS,
  };
}

export async function updateRolePermissions(id, permissions) {
  const role = await Role.findById(id);
  if (!role) throw new ApiError(404, "Role not found");

  if (role.name === OWNER_ROLE) {
    throw new ApiError(
      409,
      "The owner role cannot be edited — it always has full access.",
      { code: "owner_role_immutable" },
    );
  }

  const unique = [...new Set(permissions)];

  // Machine-only keys are rejected with their own message, before the generic unknown-key check,
  // because the honest answer is different: these ARE real permissions, they are just not for
  // humans. Granting journal.intake to a human role would hand a teammate the WhatsApp intake
  // scope through a checkbox.
  const machine = unique.filter((p) => MACHINE_ONLY_PERMISSIONS.includes(p));
  if (machine.length) {
    throw new ApiError(400, `These permissions are reserved for integrations and cannot be given to a role: ${machine.join(", ")}`, {
      code: "machine_only_permission",
      permissions: machine,
    });
  }

  const unknown = unique.filter((p) => !ASSIGNABLE_PERMISSIONS.includes(p));
  if (unknown.length) {
    throw new ApiError(400, `Unknown permission${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`, {
      code: "unknown_permission",
      permissions: unknown,
    });
  }

  role.permissions = unique;
  await role.save();

  const memberCount = await User.countDocuments({ role: role._id, removedAt: null });
  const def = roleDefinition(role.name);
  return {
    id: String(role._id),
    name: role.name,
    label: def?.label ?? role.name,
    description: def?.description ?? null,
    permissions: role.permissions,
    memberCount,
    editable: true,
    legacy: !def,
  };
}
