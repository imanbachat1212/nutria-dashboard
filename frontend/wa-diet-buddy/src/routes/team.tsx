import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
  KeyRound,
  Phone,
  Filter,
  Download,
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
import {
  TEAM_MEMBERS,
  PENDING_INVITES,
  ACCESS_LOGS,
  ROLE_META,
  STATUS_STYLES,
  ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  fmtRelative,
  fmtDate,
  type TeamMember,
  type TeamRole,
  type PendingInvite,
  type PermissionKey,
} from "@/lib/team-mock";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team & Access — Nutria" },
      { name: "description", content: "Invite teammates, assign roles and audit who did what." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>(TEAM_MEMBERS);
  const [invites, setInvites] = useState<PendingInvite[]>(PENDING_INVITES);
  const [tab, setTab] = useState("members");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleEditor, setRoleEditor] = useState<TeamRole | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const stats = useMemo(
    () => ({
      total: members.length,
      active: members.filter((m) => m.status === "active").length,
      dietitians: members.filter((m) => m.role === "dietitian").length,
      pending: invites.length,
    }),
    [members, invites],
  );

  return (
    <div>
      <PageHeader
        title="Team & Access"
        description="Invite teammates, assign roles and audit who did what — on your own clinic, your own rules."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setTab("roles")}>
              <Shield className="mr-2 h-4 w-4" />
              Manage roles
            </Button>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite teammate
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="Total members" value={stats.total} />
        <StatCard icon={CheckCircle2} label="Active" value={stats.active} tone="emerald" />
        <StatCard icon={ShieldCheck} label="Dietitians" value={stats.dietitians} tone="primary" />
        <StatCard icon={Mail} label="Pending invites" value={stats.pending} tone="amber" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Members
          </TabsTrigger>
          <TabsTrigger value="invites">
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Pending invites
            {invites.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                {invites.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Roles & permissions
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Audit log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <MembersTab
            members={members}
            onChangeRole={(id, role) =>
              setMembers((cur) => cur.map((m) => (m.id === id ? { ...m, role } : m)))
            }
            onToggleStatus={(id) =>
              setMembers((cur) =>
                cur.map((m) =>
                  m.id === id
                    ? { ...m, status: m.status === "active" ? "suspended" : "active" }
                    : m,
                ),
              )
            }
            onRemove={(m) => setRemoving(m)}
            onResetPassword={(m) => toast.success(`Password reset email sent to ${m.email}`)}
          />
        </TabsContent>

        <TabsContent value="invites" className="mt-4">
          <InvitesTab
            invites={invites}
            onResend={(inv) => toast.success(`Invite re-sent to ${inv.email}`)}
            onCopy={(inv) => {
              navigator.clipboard?.writeText(`https://nutria.health/invite/${inv.id}`);
              toast.success("Invite link copied");
            }}
            onRevoke={(id) => {
              setInvites((cur) => cur.filter((i) => i.id !== id));
              toast.success("Invite revoked");
            }}
          />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesTab onEdit={(r) => setRoleEditor(r)} />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
      </Tabs>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={(email, role) => {
          setInvites((cur) => [
            {
              id: `i-${Date.now()}`,
              email,
              role,
              invitedBy: "Sura Hawli",
              invitedAt: new Date().toISOString().slice(0, 10),
              expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
            },
            ...cur,
          ]);
          toast.success(`Invite sent to ${email}`);
          setTab("invites");
        }}
      />

      <RolePermissionsDialog
        role={roleEditor}
        onClose={() => setRoleEditor(null)}
      />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access immediately. Their clients and historical records
              stay with the clinic. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (!removing) return;
                setMembers((cur) => cur.filter((m) => m.id !== removing.id));
                toast.success(`${removing.name} removed`);
                setRemoving(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Stat ---------- */

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "muted",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "muted" | "emerald" | "amber" | "primary";
}) {
  const toneCls =
    tone === "emerald"
      ? "bg-emerald-500/10 text-emerald-600"
      : tone === "amber"
        ? "bg-amber-500/10 text-amber-600"
        : tone === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneCls)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Members ---------- */

function MembersTab({
  members,
  onChangeRole,
  onToggleStatus,
  onRemove,
  onResetPassword,
}: {
  members: TeamMember[];
  onChangeRole: (id: string, role: TeamRole) => void;
  onToggleStatus: (id: string) => void;
  onRemove: (m: TeamMember) => void;
  onResetPassword: (m: TeamMember) => void;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<TeamRole | "all">("all");

  const filtered = members.filter((m) => {
    const matchesQ =
      !query ||
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.email.toLowerCase().includes(query.toLowerCase());
    const matchesRole = roleFilter === "all" || m.role === roleFilter;
    return matchesQ && matchesRole;
  });

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Members</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {members.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="h-8 w-60 pl-7 text-xs"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as TeamRole | "all")}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <Filter className="mr-1.5 h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {(Object.keys(ROLE_META) as TeamRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_META[r].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Member</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Last active</div>
          <div className="col-span-1 text-right">Clients</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        {filtered.map((m) => {
          const role = ROLE_META[m.role];
          const status = STATUS_STYLES[m.status];
          const isOwner = m.role === "owner";
          return (
            <div
              key={m.id}
              className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0 hover:bg-muted/30"
            >
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className={cn("text-xs text-white", m.color)}>
                    {m.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium leading-tight">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
              </div>
              <div className="col-span-2">
                {isOwner ? (
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", role.cls)}>
                    {role.label}
                  </span>
                ) : (
                  <Select
                    value={m.role}
                    onValueChange={(v) => onChangeRole(m.id, v as TeamRole)}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_META) as TeamRole[])
                        .filter((r) => r !== "owner")
                        .map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_META[r].label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="col-span-2">
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", status.cls)}>
                  {status.label}
                </span>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {fmtRelative(m.lastActiveAt)}
                </span>
              </div>
              <div className="col-span-1 text-right text-sm tabular-nums">{m.clients}</div>
              <div className="col-span-1 flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onResetPassword(m)}>
                      <KeyRound className="mr-2 h-3.5 w-3.5" />
                      Send password reset
                    </DropdownMenuItem>
                    {m.phone && (
                      <DropdownMenuItem
                        onSelect={() => {
                          navigator.clipboard?.writeText(m.phone ?? "");
                          toast.success("Phone copied");
                        }}
                      >
                        <Phone className="mr-2 h-3.5 w-3.5" />
                        Copy phone
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isOwner}
                      onSelect={() => onToggleStatus(m.id)}
                    >
                      <Ban className="mr-2 h-3.5 w-3.5" />
                      {m.status === "active" ? "Suspend" : "Reactivate"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-rose-600"
                      disabled={isOwner}
                      onSelect={() => onRemove(m)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Remove from clinic
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No members match your filters.
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- Invites ---------- */

function InvitesTab({
  invites,
  onResend,
  onCopy,
  onRevoke,
}: {
  invites: PendingInvite[];
  onResend: (inv: PendingInvite) => void;
  onCopy: (inv: PendingInvite) => void;
  onRevoke: (id: string) => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Pending invites</h2>
          <p className="text-xs text-muted-foreground">
            Invites expire 7 days after being sent.
          </p>
        </div>
      </div>

      {invites.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-12 text-center">
          <Mail className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">No pending invites</p>
          <p className="text-xs text-muted-foreground">
            Invite teammates from the button at the top.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div className="col-span-5">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Invited</div>
            <div className="col-span-2">Expires</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          {invites.map((inv) => {
            const role = ROLE_META[inv.role];
            return (
              <div
                key={inv.id}
                className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0 hover:bg-muted/30"
              >
                <div className="col-span-5 min-w-0">
                  <p className="truncate font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">by {inv.invitedBy}</p>
                </div>
                <div className="col-span-2">
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", role.cls)}>
                    {role.label}
                  </span>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {fmtDate(inv.invitedAt)}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {fmtDate(inv.expiresAt)}
                </div>
                <div className="col-span-1 flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onCopy(inv)}
                    title="Copy invite link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onResend(inv)}
                    title="Resend"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-rose-600"
                    onClick={() => onRevoke(inv.id)}
                    title="Revoke"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ---------- Roles & permissions ---------- */

function RolesTab({ onEdit }: { onEdit: (r: TeamRole) => void }) {
  const roles = Object.keys(ROLE_META) as TeamRole[];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {roles.map((r) => {
        const meta = ROLE_META[r];
        const perms = ROLE_PERMISSIONS[r];
        const total = PERMISSION_GROUPS.reduce((n, g) => n + g.items.length, 0);
        return (
          <Card key={r} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.cls)}>
                  {meta.label}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={r === "owner"}
                onClick={() => onEdit(r)}
              >
                Edit
              </Button>
            </div>
            <div className="mt-4 flex items-end justify-between border-t pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Permissions
                </p>
                <p className="text-sm font-medium tabular-nums">
                  {perms.length} <span className="text-muted-foreground">/ {total}</span>
                </p>
              </div>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.round((perms.length / total) * 100)}%` }}
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function RolePermissionsDialog({
  role,
  onClose,
}: {
  role: TeamRole | null;
  onClose: () => void;
}) {
  const [perms, setPerms] = useState<PermissionKey[]>([]);

  // sync when role changes
  const initial = role ? ROLE_PERMISSIONS[role] : [];
  if (role && perms !== initial && perms.length === 0) {
    // initialize on open
    setPerms(initial);
  }

  if (!role) return null;
  const meta = ROLE_META[role];

  const toggle = (k: PermissionKey) =>
    setPerms((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) {
          setPerms([]);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Permissions
            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.cls)}>
              {meta.label}
            </span>
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-2 rounded-md border p-3">
                {group.items.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-start gap-3"
                  >
                    <Checkbox
                      checked={perms.includes(item.key)}
                      onCheckedChange={() => toggle(item.key)}
                    />
                    <div className="flex-1 leading-tight">
                      <p className="text-sm">{item.label}</p>
                      {item.hint && (
                        <p className="text-[11px] text-muted-foreground">{item.hint}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setPerms([]);
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              toast.success(`${meta.label} permissions updated`);
              setPerms([]);
              onClose();
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Audit log ---------- */

function AuditTab() {
  const [query, setQuery] = useState("");
  const filtered = ACCESS_LOGS.filter(
    (l) =>
      !query ||
      l.actor.toLowerCase().includes(query.toLowerCase()) ||
      l.action.toLowerCase().includes(query.toLowerCase()) ||
      l.target.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Audit log</h2>
          <p className="text-xs text-muted-foreground">
            Sensitive actions across the clinic — last 30 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter log…"
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("Audit log exported")}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="col-span-3">Who</div>
          <div className="col-span-2">Action</div>
          <div className="col-span-4">Target</div>
          <div className="col-span-3 text-right">When · Device</div>
        </div>
        {filtered.map((l) => (
          <div
            key={l.id}
            className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0 hover:bg-muted/30"
          >
            <div className="col-span-3 min-w-0">
              <p className="truncate font-medium">{l.actor}</p>
              <p className="truncate text-[11px] text-muted-foreground">{l.ip}</p>
            </div>
            <div className="col-span-2 text-sm">{l.action}</div>
            <div className="col-span-4 truncate text-xs text-muted-foreground">{l.target}</div>
            <div className="col-span-3 text-right text-xs text-muted-foreground">
              <p>{fmtRelative(l.at)}</p>
              <p className="text-[10px]">{l.device}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No matching entries.
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- Invite dialog ---------- */

function InviteDialog({
  open,
  onOpenChange,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInvite: (email: string, role: TeamRole) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("dietitian");
  const meta = ROLE_META[role];

  const reset = () => {
    setEmail("");
    setRole("dietitian");
  };

  const valid = /.+@.+\..+/.test(email);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Invite teammate
          </DialogTitle>
          <DialogDescription>
            They'll receive an email with a magic link to join your clinic.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@nutria.health"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_META) as TeamRole[])
                  .filter((r) => r !== "owner")
                  .map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_META[r].label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className={cn("mt-1 rounded-md border p-2 text-xs", meta.cls)}>
              {meta.description}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onInvite(email, role);
              reset();
              onOpenChange(false);
            }}
          >
            <Send className="mr-2 h-4 w-4" />
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
