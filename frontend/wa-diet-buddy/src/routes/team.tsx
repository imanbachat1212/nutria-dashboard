import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  MoreHorizontal,
  Mail,
  Shield,
  ShieldCheck,
  Users,
  Clock,
  Activity,
  Copy,
  CheckCircle2,
  Ban,
  Send,
  Trash2,
  Phone,
  Download,
  Loader2,
  AlertTriangle,
  Link as LinkIcon,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { roleMeta, STATUS_STYLES, fmtRelative, fmtDate } from "@/lib/team-mock";
import {
  fetchTeamMembers,
  updateTeamMember,
  removeTeamMember,
  fetchInvites,
  createInvite,
  resendInvite,
  revokeInvite,
  fetchRoles,
  updateRolePermissions,
  fetchAuditLog,
  fetchAuditFacets,
  errorMessage,
  permissionAction,
  type TeamMember,
  type TeamInvite,
  type InviteResult,
  type TeamRoleRow,
  type RolesResponse,
  type AuditEntry,
} from "@/lib/team-api";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team & Access — Nutria" },
      { name: "description", content: "Invite teammates, assign roles and audit who did what." },
    ],
  }),
  component: TeamPage,
});

const QK = {
  members: ["team", "members"],
  invites: ["team", "invites"],
  roles: ["team", "roles"],
  audit: ["team", "audit"],
};

// A single frozen empty array, reused as the fallback for every not-yet-loaded query below.
// `?? []` would mint a new array on every render, so the useMemos that depend on these lists
// would see a changed dependency every time and recompute regardless — memoising nothing.
const EMPTY: never[] = [];

function TeamPage() {
  const qc = useQueryClient();
  const { user, can } = useAuth();
  const [tab, setTab] = useState("members");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [linkResult, setLinkResult] = useState<InviteResult | null>(null);

  const canAudit = can("audit.read");

  const membersQ = useQuery({ queryKey: QK.members, queryFn: fetchTeamMembers });
  const invitesQ = useQuery({ queryKey: QK.invites, queryFn: fetchInvites });
  const rolesQ = useQuery({ queryKey: QK.roles, queryFn: fetchRoles });

  // Every write touches more than one of these — changing a role moves a member AND a role's
  // member count AND writes an audit row — so each mutation invalidates all four rather than
  // trying to predict which views went stale.
  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  const members: TeamMember[] = membersQ.data?.users ?? EMPTY;
  const invites: TeamInvite[] = invitesQ.data ?? EMPTY;
  const roles: TeamRoleRow[] = rolesQ.data?.roles ?? EMPTY;

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.role?.name ?? "").toLowerCase().includes(q),
    );
  }, [members, query]);

  const stats = useMemo(
    () => ({
      total: members.length,
      active: members.filter((m) => m.status === "active").length,
      pendingInvites: invites.filter((i) => i.status === "pending").length,
      roles: roles.length,
    }),
    [members, invites, roles],
  );

  return (
    <div className="mx-auto max-w-350">
      <PageHeader
        eyebrow="Admin"
        title="Team & Access"
        description="Invite teammates, assign roles, and review everything that has been changed."
        actions={
          can("users.create") ? (
            <Button className="gap-1.5" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite teammate
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Team members"
          value={stats.total}
          hint={`${stats.active} active`}
          loading={membersQ.isLoading}
        />
        <StatCard
          icon={<Mail className="h-4 w-4" />}
          label="Pending invites"
          value={stats.pendingInvites}
          hint={
            invites.length > stats.pendingInvites
              ? `${invites.length - stats.pendingInvites} expired`
              : "awaiting acceptance"
          }
          loading={invitesQ.isLoading}
        />
        <StatCard
          icon={<Shield className="h-4 w-4" />}
          label="Roles"
          value={stats.roles}
          hint="permission sets"
          loading={rolesQ.isLoading}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Owners"
          value={members.filter((m) => m.role?.name === "owner" && m.status === "active").length}
          hint="can manage the team"
          loading={membersQ.isLoading}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="members" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Members
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Invites
              {stats.pendingInvites > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {stats.pendingInvites}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Roles
            </TabsTrigger>
            {/* Only rendered with audit.read — the log reveals who touched which client record. */}
            {canAudit && (
              <TabsTrigger value="audit" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Audit log
              </TabsTrigger>
            )}
          </TabsList>
          {tab === "members" && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members…"
                className="h-9 w-64 pl-8 text-sm"
              />
            </div>
          )}
        </div>

        <TabsContent value="members">
          <MembersTab
            members={filteredMembers}
            roles={roles}
            loading={membersQ.isLoading}
            error={membersQ.error}
            currentUserId={user?._id ?? null}
            canUpdate={can("users.update")}
            canDelete={can("users.delete")}
            onChanged={invalidateAll}
          />
        </TabsContent>

        <TabsContent value="invites">
          <InvitesTab
            invites={invites}
            loading={invitesQ.isLoading}
            canManage={can("users.update")}
            onChanged={invalidateAll}
            onLink={setLinkResult}
          />
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab
            data={rolesQ.data}
            loading={rolesQ.isLoading}
            canEdit={can("users.update")}
            onChanged={invalidateAll}
          />
        </TabsContent>

        {canAudit && (
          <TabsContent value="audit">
            <AuditTab />
          </TabsContent>
        )}
      </Tabs>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roles={roles}
        onDone={(result) => {
          invalidateAll();
          if (!result.emailSent) setLinkResult(result);
        }}
      />

      <InviteLinkDialog result={linkResult} onOpenChange={(o) => !o && setLinkResult(null)} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-semibold">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </Card>
  );
}

// ── Members ─────────────────────────────────────────────────────────────────

function MembersTab({
  members,
  roles,
  loading,
  error,
  currentUserId,
  canUpdate,
  canDelete,
  onChanged,
}: {
  members: TeamMember[];
  roles: TeamRoleRow[];
  loading: boolean;
  error: unknown;
  currentUserId: string | null;
  canUpdate: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Every mutation surfaces the SERVER's message on failure. That matters here more than
  // anywhere else on the page: the guards (last owner, yourself, owner-only) are enforced in the
  // service and their messages are written to be read by a person — "Sura is the only active
  // owner — suspending them would leave the practice with no one who can manage the team."
  async function run(id: string, fn: () => Promise<unknown>, okMessage: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMessage);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading)
    return (
      <Card className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );
  if (error)
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Couldn&apos;t load the team: {errorMessage(error)}
      </Card>
    );

  return (
    <Card className="divide-y p-0">
      {members.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">No team members match.</div>
      )}
      {members.map((m) => {
        const meta = roleMeta(m.role?.name);
        const isSelf = currentUserId != null && m.id === currentUserId;
        const neverLoggedIn = m.lastLoginAt == null;
        const busy = busyId === m.id;
        return (
          <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                {m.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{m.name}</span>
                {isSelf && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    You
                  </Badge>
                )}
                {/* Display accounts: referenced by appointments.staffId, never signed in. Without
                    this they look like teammates who simply haven't been active lately. */}
                {neverLoggedIn && (
                  <Badge
                    variant="outline"
                    className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground"
                    title="This account has never signed in"
                  >
                    No login
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="truncate">{m.email}</span>
                {m.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {m.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {m.lastActiveAt ? `active ${fmtRelative(m.lastActiveAt)}` : "never active"}
                </span>
                <span>joined {fmtDate(m.joinedAt)}</span>
              </div>
            </div>

            <Badge variant="outline" className={cn("rounded-md text-[11px]", meta.cls)}>
              {meta.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn("rounded-md text-[11px]", STATUS_STYLES[m.status].cls)}
            >
              {STATUS_STYLES[m.status].label}
            </Badge>

            {canUpdate && (
              <Select
                value={m.role?.id ?? ""}
                disabled={busy || isSelf}
                onValueChange={(roleId) =>
                  run(
                    m.id,
                    () => updateTeamMember(m.id, { role: roleId }),
                    `${m.name}'s role updated`,
                  )
                }
              >
                {/* Disabled on yourself: the server refuses it anyway (you cannot change your own
                    role), and offering a control that always fails is worse than not offering it. */}
                <SelectTrigger
                  className="h-8 w-36 text-xs"
                  title={isSelf ? "You cannot change your own role" : undefined}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs">
                      {roleMeta(r.name).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canUpdate && m.status === "active" && (
                  <DropdownMenuItem
                    disabled={isSelf}
                    onClick={() =>
                      run(
                        m.id,
                        () => updateTeamMember(m.id, { active: false }),
                        `${m.name} suspended`,
                      )
                    }
                  >
                    <Ban className="mr-2 h-3.5 w-3.5" />
                    Suspend access
                  </DropdownMenuItem>
                )}
                {canUpdate && m.status === "suspended" && (
                  <DropdownMenuItem
                    onClick={() =>
                      run(
                        m.id,
                        () => updateTeamMember(m.id, { active: true }),
                        `${m.name} reactivated`,
                      )
                    }
                  >
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    Reactivate
                  </DropdownMenuItem>
                )}
                {/* "Reset password" is deliberately absent. It used to fire a toast and do
                    nothing; an admin-initiated reset flow is its own piece of work. */}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      disabled={isSelf}
                      onClick={() => setConfirmRemove(m)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Remove from team
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmRemove?.name} from the team?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access immediately, including any session they already have open. Their
              account is kept rather than deleted, so past appointments and audit entries still show
              who they were, and their email address stays reserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const m = confirmRemove!;
                setConfirmRemove(null);
                run(m.id, () => removeTeamMember(m.id), `${m.name} removed from the team`);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Invites ─────────────────────────────────────────────────────────────────

function InvitesTab({
  invites,
  loading,
  canManage,
  onChanged,
  onLink,
}: {
  invites: TeamInvite[];
  loading: boolean;
  canManage: boolean;
  onChanged: () => void;
  onLink: (r: InviteResult) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function copyLink(inv: TeamInvite) {
    setBusyId(inv.id);
    try {
      // Copy goes through RESEND, which rotates the token server-side — so any link handed out
      // earlier stops working the moment this is clicked. The toast says so, because silently
      // invalidating a link someone already sent would be a nasty surprise.
      const result = await resendInvite(inv.id);
      await navigator.clipboard.writeText(result.link);
      toast.success("New link copied", {
        description: "Any earlier link for this invite no longer works.",
      });
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function run(id: string, fn: () => Promise<unknown>, ok: string, description?: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(ok, description ? { description } : undefined);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading)
    return (
      <Card className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );

  if (!invites.length) {
    return (
      <Card className="flex flex-col items-center gap-2 p-12 text-center">
        <Mail className="h-7 w-7 text-muted-foreground" />
        <p className="font-display text-base font-semibold">No pending invitations</p>
        <p className="text-sm text-muted-foreground">
          Invitations appear here until they&apos;re accepted or revoked.
        </p>
      </Card>
    );
  }

  return (
    <Card className="divide-y p-0">
      {invites.map((inv) => {
        const meta = roleMeta(inv.role?.name);
        const expired = inv.status === "expired";
        const busy = busyId === inv.id;
        return (
          <div key={inv.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{inv.email}</p>
              <p className="text-[11px] text-muted-foreground">
                invited by {inv.invitedByName ?? "someone"} · {fmtDate(inv.createdAt)}
                {inv.lastSentAt ? ` · emailed ${fmtRelative(inv.lastSentAt)}` : " · not emailed"}
              </p>
            </div>
            <Badge variant="outline" className={cn("rounded-md text-[11px]", meta.cls)}>
              {meta.label}
            </Badge>
            {expired ? (
              <Badge
                variant="outline"
                className="rounded-md border-rose-200 bg-rose-50 text-[11px] text-rose-700"
              >
                Expired {fmtRelative(inv.expiresAt)}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="rounded-md border-amber-200 bg-amber-50 text-[11px] text-amber-700"
              >
                Expires {fmtDate(inv.expiresAt)}
              </Badge>
            )}
            {canManage && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={busy}
                  onClick={() => copyLink(inv)}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={busy}
                  onClick={() =>
                    run(
                      inv.id,
                      async () => {
                        const r = await resendInvite(inv.id);
                        if (!r.emailSent) onLink(r);
                        return r;
                      },
                      expired ? "Invitation renewed" : "Invitation resent",
                      "A new link was issued; the previous one no longer works.",
                    )
                  }
                >
                  {expired ? (
                    <RotateCw className="h-3.5 w-3.5" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {expired ? "Renew" : "Resend"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  disabled={busy}
                  onClick={() => run(inv.id, () => revokeInvite(inv.id), "Invitation revoked")}
                  title="Revoke invitation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

// ── Roles ───────────────────────────────────────────────────────────────────

const ACTION_COLUMNS = ["read", "create", "update", "delete"] as const;

// Not every permission key ends in one of those four. `clients.clinical.write`, `media.upload`
// and `webhooks.manage` are all real, enforced keys whose action is something else — and with a
// fixed four-column table they rendered as dashes, which meant an owner could not grant or revoke
// them from this screen AT ALL. Caught by looking at the rendered matrix rather than the code.
//
// Rather than widening the table with three mostly-empty columns, anything non-standard appears
// in a trailing "Other" cell as a labelled checkbox, so every key in the registry is reachable.
function otherKeys(keys: string[]): string[] {
  return keys.filter((k) => !(ACTION_COLUMNS as readonly string[]).includes(permissionAction(k)));
}

function RolesTab({
  data,
  loading,
  canEdit,
  onChanged,
}: {
  data: RolesResponse | undefined;
  loading: boolean;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<TeamRoleRow | null>(null);

  if (loading || !data)
    return (
      <Card className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.roles.map((r) => {
          const meta = roleMeta(r.name);
          return (
            <Card key={r.id} className="flex flex-col gap-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="outline" className={cn("rounded-md text-[11px]", meta.cls)}>
                    {meta.label}
                  </Badge>
                  {r.legacy && (
                    <Badge
                      variant="outline"
                      className="ml-1.5 rounded-md text-[10px] text-muted-foreground"
                    >
                      retired
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {r.memberCount} member{r.memberCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{r.description ?? meta.description}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"}
              </p>
              <div className="mt-auto pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full text-xs"
                  onClick={() => setEditing(r)}
                >
                  {/* Owner is viewable but not editable — see the dialog. */}
                  {r.editable && canEdit ? "Edit permissions" : "View permissions"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <RolePermissionsDialog
        role={editing}
        groups={data.permissionGroups}
        canEdit={canEdit}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onChanged();
        }}
      />
    </>
  );
}

function RolePermissionsDialog({
  role,
  groups,
  canEdit,
  onOpenChange,
  onSaved,
}: {
  role: TeamRoleRow | null;
  groups: RolesResponse["permissionGroups"];
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Reset the draft whenever a different role is opened. Derived during render rather than in an
  // effect so the first paint already shows the right ticks.
  if (role && loadedFor !== role.id) {
    setLoadedFor(role.id);
    setDraft(new Set(role.permissions));
  }

  const locked = !role?.editable || !canEdit;

  async function save() {
    if (!role) return;
    setSaving(true);
    try {
      await updateRolePermissions(role.id, [...draft]);
      toast.success(`${roleMeta(role.name).label} permissions updated`);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!role} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{role ? roleMeta(role.name).label : ""} permissions</DialogTitle>
          <DialogDescription>
            {role?.editable === false
              ? "The owner role always has full access and can't be edited — otherwise an owner could remove their own ability to manage the team."
              : "Rows are modules, columns are what this role can do. Only permissions the backend actually enforces are listed."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 text-left font-medium">Module</th>
                {ACTION_COLUMNS.map((a) => (
                  <th key={a} className="px-2 py-2 text-center font-medium">
                    {a}
                  </th>
                ))}
                <th className="px-2 py-2 text-left font-medium">Other</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.module} className="border-b last:border-0">
                  <td className="px-2 py-2 text-xs font-medium">{g.label}</td>
                  {ACTION_COLUMNS.map((action) => {
                    // A module only has the cells its keys define — "Reports" has no delete, and
                    // "Audit log" only has read. Empty cells render as a dash rather than an
                    // unchecked box that could never be ticked.
                    const key = g.keys.find((k) => permissionAction(k) === action);
                    if (!key)
                      return (
                        <td key={action} className="px-2 py-2 text-center text-muted-foreground/30">
                          —
                        </td>
                      );
                    return (
                      <td key={action} className="px-2 py-2 text-center">
                        <Checkbox
                          checked={draft.has(key)}
                          disabled={locked || saving}
                          onCheckedChange={(v) =>
                            setDraft((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(key);
                              else next.delete(key);
                              return next;
                            })
                          }
                          aria-label={key}
                        />
                      </td>
                    );
                  })}
                  <td className="px-2 py-2">
                    {otherKeys(g.keys).length === 0 ? (
                      <span className="text-muted-foreground/30">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {otherKeys(g.keys).map((key) => (
                          <label key={key} className="flex items-center gap-1.5 text-[11px]">
                            <Checkbox
                              checked={draft.has(key)}
                              disabled={locked || saving}
                              onCheckedChange={(v) =>
                                setDraft((prev) => {
                                  const next = new Set(prev);
                                  if (v) next.add(key);
                                  else next.delete(key);
                                  return next;
                                })
                              }
                              aria-label={key}
                            />
                            {permissionAction(key)}
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {locked ? "Close" : "Cancel"}
          </Button>
          {!locked && (
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save permissions
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Audit ───────────────────────────────────────────────────────────────────

function AuditTab() {
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<AuditEntry[]>([]);

  const facetsQ = useQuery({ queryKey: ["team", "audit", "facets"], queryFn: fetchAuditFacets });

  const filters = {
    entity: entity === "all" ? undefined : entity,
    action: action === "all" ? undefined : action,
    q: q.trim() || undefined,
  };

  const auditQ = useQuery({
    queryKey: ["team", "audit", filters, page],
    queryFn: async () => {
      const res = await fetchAuditLog({ ...filters, page, limit: 50 });
      // "Load more" appends; a filter change resets to page 1 and replaces.
      setAccumulated((prev) => (page === 1 ? res.entries : [...prev, ...res.entries]));
      return res;
    },
  });

  function resetFilters(fn: () => void) {
    fn();
    setPage(1);
    setAccumulated([]);
  }

  // Exports what is ON SCREEN, which is what the button can honestly promise — it does not
  // silently re-query the whole collection behind a filter the user is looking at.
  function exportCsv() {
    const head = ["when", "actor", "role", "action", "entity", "entityId", "ip"];
    const rows = accumulated.map((e) => [
      new Date(e.at).toISOString(),
      e.actor?.name ?? "",
      e.actorRole ?? "",
      e.action,
      e.entity,
      e.entityId ?? "",
      e.ip ?? "",
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutria-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => resetFilters(() => setQ(e.target.value))}
            placeholder="Search person or entity…"
            className="h-9 w-60 pl-8 text-sm"
          />
        </div>
        <Select value={entity} onValueChange={(v) => resetFilters(() => setEntity(v))}>
          <SelectTrigger className="h-9 w-40 text-xs">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All entities
            </SelectItem>
            {(facetsQ.data?.entities ?? []).map((e) => (
              <SelectItem key={e} value={e} className="text-xs">
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={(v) => resetFilters(() => setAction(v))}>
          <SelectTrigger className="h-9 w-44 text-xs">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All actions
            </SelectItem>
            {(facetsQ.data?.actions ?? []).map((a) => (
              <SelectItem key={a} value={a} className="text-xs">
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-9 gap-1.5 text-xs"
          onClick={exportCsv}
          disabled={!accumulated.length}
        >
          <Download className="h-3.5 w-3.5" />
          Export {accumulated.length} rows
        </Button>
      </div>

      {auditQ.isLoading && page === 1 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : accumulated.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nothing matches these filters.
        </p>
      ) : (
        <div className="divide-y">
          {accumulated.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-2.5 py-2.5 text-sm">
              <span className="w-36 shrink-0 text-[11px] text-muted-foreground">
                {fmtRelative(e.at)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{e.actor?.name ?? "System"}</span>
                <span className="text-muted-foreground"> {e.action} </span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {e.entity}
                </Badge>
              </span>
              {e.actorRole && (
                <span className="text-[11px] text-muted-foreground">{e.actorRole}</span>
              )}
              {e.ip && (
                <span className="hidden text-[11px] text-muted-foreground sm:inline">{e.ip}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {auditQ.data?.hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={auditQ.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {auditQ.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Load more ({accumulated.length} of {auditQ.data.total})
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Invite dialogs ──────────────────────────────────────────────────────────

function InviteDialog({
  open,
  onOpenChange,
  roles,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roles: TeamRoleRow[];
  onDone: (r: InviteResult) => void;
}) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [sending, setSending] = useState(false);

  const defaultRole = roles.find((r) => r.name === "dietitian") ?? roles[0];
  const effectiveRole = roleId || defaultRole?.id || "";

  async function send() {
    setSending(true);
    try {
      const result = await createInvite(email.trim(), effectiveRole);
      if (result.emailSent) {
        toast.success(`Invitation emailed to ${result.invite.email}`);
      } else {
        toast.success(`Invitation created for ${result.invite.email}`, {
          description: "Email isn't configured — copy the link to send it yourself.",
        });
      }
      setEmail("");
      setRoleId("");
      onOpenChange(false);
      onDone(result);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They&apos;ll get a link to choose their own password. It expires in 7 days and can only
            be used once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email-field">Email</Label>
            <Input
              id="invite-email-field"
              type="email"
              value={email}
              autoFocus
              disabled={sending}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@practice.com"
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.includes("@")) send();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={effectiveRole} onValueChange={setRoleId} disabled={sending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex flex-col items-start">
                      <span>{roleMeta(r.name).label}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {r.description ?? roleMeta(r.name).description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={send}
            disabled={sending || !email.includes("@") || !effectiveRole}
            className="gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Shown when an invite was created but no email went out — the link is the only way the person
// can accept, so it is presented prominently rather than hidden behind a menu.
function InviteLinkDialog({
  result,
  onOpenChange,
}: {
  result: InviteResult | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={!!result} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-amber-600" />
            Send this link to {result?.invite.email}
          </DialogTitle>
          <DialogDescription>
            {result?.emailError
              ? `The invitation was created, but the email couldn't be sent (${result.emailError}).`
              : "Email sending isn't configured on this server, so the invitation wasn't emailed."}{" "}
            Copy the link below and send it yourself.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-900">
            Anyone with this link can create an account as{" "}
            <strong>{result ? roleMeta(result.invite.role?.name).label : ""}</strong>. Send it only
            to {result?.invite.email}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={result?.link ?? ""}
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            variant="outline"
            className="shrink-0 gap-1.5"
            onClick={() => {
              if (!result) return;
              navigator.clipboard.writeText(result.link);
              toast.success("Link copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
