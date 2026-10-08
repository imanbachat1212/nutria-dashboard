import { api, type ApiRequestError } from "./api";

// Team & Access (prompt-125). Replaces src/lib/team-mock.ts's TEAM_MEMBERS / PENDING_INVITES /
// ACCESS_LOGS, which were arrays held in useState — inviting, suspending or changing a role moved
// numbers around on screen and saved nothing.

// ── Members ─────────────────────────────────────────────────────────────────

export type MemberStatus = "active" | "suspended";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: { id: string; name: string } | null;
  status: MemberStatus;
  joinedAt: string;
  lastActiveAt: string | null;
  /**
   * null = has never signed in. The six seeded staff-directory accounts
   * (sura.hawli@nutri.app and friends) are referenced by appointments.staffId but were created
   * with random passwords and nobody logs into them — the UI tags these so they aren't mistaken
   * for real teammates.
   */
  lastLoginAt: string | null;
}

export async function fetchTeamMembers(): Promise<{ users: TeamMember[]; total: number }> {
  return api.get<{ users: TeamMember[]; total: number }>("/api/users");
}

export async function updateTeamMember(
  id: string,
  data: { name?: string; phone?: string | null; role?: string; active?: boolean },
): Promise<TeamMember> {
  return api.patch<TeamMember>(`/api/users/${id}`, data);
}

/** Soft remove — the account is kept so appointments and audit rows still resolve. */
export async function removeTeamMember(id: string): Promise<TeamMember> {
  return api.delete<TeamMember>(`/api/users/${id}`);
}

// ── Invites ─────────────────────────────────────────────────────────────────

export interface TeamInvite {
  id: string;
  email: string;
  role: { id: string; name: string | null } | null;
  status: "pending" | "expired";
  expiresAt: string;
  lastSentAt: string | null;
  createdAt: string;
  invitedByName: string | null;
}

export interface InviteResult {
  invite: TeamInvite;
  /** The accept link. Shown so an invite still works with no mail provider configured. */
  link: string;
  emailSent: boolean;
  emailError: string | null;
}

export async function fetchInvites(): Promise<TeamInvite[]> {
  return api.get<TeamInvite[]>("/api/users/invites");
}

export async function createInvite(email: string, role: string): Promise<InviteResult> {
  return api.post<InviteResult>("/api/users/invites", { email, role });
}

/**
 * Resend ROTATES the token — any previously issued link for this invite stops working.
 * "Copy link" uses this same call, which is why its toast says so.
 */
export async function resendInvite(id: string): Promise<InviteResult> {
  return api.post<InviteResult>(`/api/users/invites/${id}/resend`, {});
}

export async function revokeInvite(id: string): Promise<TeamInvite> {
  return api.delete<TeamInvite>(`/api/users/invites/${id}`);
}

// ── Roles ───────────────────────────────────────────────────────────────────

export interface PermissionGroup {
  module: string;
  label: string;
  keys: string[];
}

export interface TeamRoleRow {
  id: string;
  name: string;
  label: string;
  description: string | null;
  permissions: string[];
  memberCount: number;
  /** false for owner — always full access, never editable. */
  editable: boolean;
  /** true for a role with no definition in the backend (the retired "assistant"). */
  legacy: boolean;
}

export interface RolesResponse {
  roles: TeamRoleRow[];
  /** The registry the matrix is built from, so the UI can never offer a key the API rejects. */
  permissionGroups: PermissionGroup[];
  assignablePermissions: string[];
}

export async function fetchRoles(): Promise<RolesResponse> {
  return api.get<RolesResponse>("/api/roles");
}

export async function updateRolePermissions(
  id: string,
  permissions: string[],
): Promise<TeamRoleRow> {
  return api.patch<TeamRoleRow>(`/api/roles/${id}`, { permissions });
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: { id: string; name: string; email: string } | null;
  actorRole: string | null;
  at: string;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export async function fetchAuditLog(
  params: {
    entity?: string;
    action?: string;
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<AuditPage> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return api.get<AuditPage>(`/api/audit${q ? `?${q}` : ""}`);
}

export async function fetchAuditFacets(): Promise<{ actions: string[]; entities: string[] }> {
  return api.get<{ actions: string[]; entities: string[] }>("/api/audit/facets");
}

// ── Public invite acceptance (no auth) ──────────────────────────────────────

export interface InviteDetails {
  email: string;
  roleName: string | null;
  invitedByName: string | null;
  expiresAt: string;
}

export async function fetchInviteByToken(token: string): Promise<InviteDetails> {
  return api.get<InviteDetails>(`/api/auth/invite/${encodeURIComponent(token)}`);
}

export async function acceptInvite(payload: {
  token: string;
  name: string;
  password: string;
}): Promise<{
  token: string;
  user: { _id: string; email: string; name: string; role: { name: string; permissions: string[] } };
}> {
  return api.post("/api/auth/accept-invite", payload);
}

/** The server's message, which carries the guard explanations (last owner, self, owner-only). */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = err as ApiRequestError;
  return e?.message || fallback;
}

/** Splits "clients.clinical.read" into its action half for the permission matrix columns. */
export function permissionAction(key: string): string {
  const parts = key.split(".");
  return parts[parts.length - 1];
}
