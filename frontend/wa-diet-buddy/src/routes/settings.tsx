import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Plug,
  ShieldAlert,
  CreditCard,
  Dumbbell,
  Save,
  Check,
  KeyRound,
  Mail,
  MessageSquare,
  Calendar,
  CreditCard as CardIcon,
  Copy,
  RotateCw,
  Plus,
  Pencil,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PACKAGES, fmtMoney, type PackageDef } from "@/lib/billing-mock";
import { fetchClassTypes, updateClassTypes } from "@/lib/settings-api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Nutria" },
      {
        name: "description",
        content: "Notifications, integrations, service packages and security.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [tab, setTab] = useState("notifications");

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure notifications, integrations, service packages and security in one place."
        actions={
          <Button size="sm" onClick={() => toast.success("Settings saved")}>
            <Save className="mr-2 h-4 w-4" />
            Save all
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="notifications">
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="mr-1.5 h-3.5 w-3.5" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="plan">
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Plan
          </TabsTrigger>
          <TabsTrigger value="services">
            <Dumbbell className="mr-1.5 h-3.5 w-3.5" />
            Services
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          <PackagesTab />
        </TabsContent>
        <TabsContent value="services" className="mt-4">
          <ServicesTab />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Reusable section ---------- */

function Section({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">
          {footer}
        </div>
      )}
    </Card>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ---------- Notifications ---------- */

function NotificationsTab() {
  return (
    <div className="grid gap-4">
      <Section title="Client notifications" description="What gets sent to your clients — and how.">
        <NotifRow
          icon={Calendar}
          label="Appointment reminder"
          hint="Sent 24h and 2h before each appointment"
          channels={{ email: true, whatsapp: true }}
        />
        <Separator className="my-1" />
        <NotifRow
          icon={CardIcon}
          label="Invoice receipt"
          hint="Automatic when an invoice is marked paid"
          channels={{ email: true, whatsapp: false }}
        />
        <Separator className="my-1" />
        <NotifRow
          icon={MessageSquare}
          label="Plan published"
          hint="When you publish a new meal or gym plan"
          channels={{ email: true, whatsapp: true }}
        />
        <Separator className="my-1" />
        <NotifRow
          icon={Mail}
          label="Weekly check-in"
          hint="Sunday recap with goals and adherence"
          channels={{ email: true, whatsapp: false }}
        />
      </Section>

      <Section title="Internal alerts" description="Sent to you and your team.">
        <Row label="New booking from website" hint="Email + push to your phone">
          <Switch defaultChecked />
        </Row>
        <Separator />
        <Row label="Failed payment" hint="When an invoice payment fails">
          <Switch defaultChecked />
        </Row>
        <Separator />
        <Row label="Client missed appointment" hint="No-show alert with one-tap reschedule">
          <Switch defaultChecked />
        </Row>
        <Separator />
        <Row label="Weekly KPI digest" hint="Mondays 8am — revenue, churn, adherence">
          <Switch />
        </Row>
      </Section>
    </div>
  );
}

function NotifRow({
  icon: Icon,
  label,
  hint,
  channels,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  channels: { email: boolean; whatsapp: boolean };
}) {
  const [c, setC] = useState(channels);
  return (
    <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pl-11 md:pl-0">
        <ChannelToggle label="Email" active={c.email} onChange={(v) => setC({ ...c, email: v })} />
        <ChannelToggle
          label="WhatsApp"
          active={c.whatsapp}
          onChange={(v) => setC({ ...c, whatsapp: v })}
        />
      </div>
    </div>
  );
}

function ChannelToggle({
  label,
  active,
  onChange,
}: {
  label: string;
  active: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {label}
    </button>
  );
}

/* ---------- Integrations ---------- */

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
  color: string;
}

function IntegrationsTab() {
  const [items, setItems] = useState<Integration[]>([
    {
      id: "google",
      name: "Google Calendar",
      description: "Two-way sync for appointments",
      icon: Calendar,
      connected: true,
      color: "text-sky-600 bg-sky-500/10",
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      description: "Send reminders and plans on WhatsApp",
      icon: MessageSquare,
      connected: false,
      color: "text-emerald-600 bg-emerald-500/10",
    },
  ]);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((it) => (
          <Card key={it.id} className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn("flex h-10 w-10 items-center justify-center rounded-lg", it.color)}
              >
                <it.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{it.name}</h3>
                  {it.connected && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700"
                    >
                      Connected
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{it.description}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end border-t pt-3">
              {it.connected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600"
                  onClick={() => {
                    setItems((cur) =>
                      cur.map((x) => (x.id === it.id ? { ...x, connected: false } : x)),
                    );
                    toast.success(`${it.name} disconnected`);
                  }}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setItems((cur) =>
                      cur.map((x) => (x.id === it.id ? { ...x, connected: true } : x)),
                    );
                    toast.success(`${it.name} connected`);
                  }}
                >
                  Connect
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Section title="API access" description="Build your own integrations with the Nutria API.">
        <Row
          label="Personal access token"
          hint="Use this token in the Authorization header — keep it secret."
        >
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value="ntra_••••••••••••••••cf3a"
              className="h-8 w-56 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                navigator.clipboard?.writeText("ntra_test_cf3a");
                toast.success("Token copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => toast.success("New token generated")}
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Row>
        <Separator />
        <Row label="Webhook endpoint" hint="POST events for new bookings & payments">
          <Input defaultValue="https://api.yourdomain.com/nutria" className="h-8 w-64 text-xs" />
        </Row>
      </Section>
    </div>
  );
}

/* ---------- Plan (service packages) ----------
 * Sourced from the same PACKAGES array the Billing page and New Invoice dialog read from
 * (@/lib/billing-mock) — no second copy of the package data. Edits here are local component
 * state seeded from that import, same pattern as IntegrationsTab's connect/disconnect above:
 * they don't propagate live to Billing/New Invoice in this session (there's no shared store
 * or backend yet — `billing` is still a stub module per TODO.md). When package management
 * gets real backend wiring, all three consumers should switch to one React Query–backed
 * source and this local-state duplication goes away on its own.
 */

function PackagesTab() {
  const [packages, setPackages] = useState<PackageDef[]>(PACKAGES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Service packages</h2>
          <p className="text-xs text-muted-foreground">
            The subscription tiers clients are billed on — pricing, included services, and who's
            currently on each one.
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add package
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {packages.map((p) =>
          editingId === p.id ? (
            <PackageEditor
              key={p.id}
              initial={p}
              onCancel={() => setEditingId(null)}
              onSave={(updated) => {
                setPackages((cur) => cur.map((x) => (x.id === p.id ? updated : x)));
                setEditingId(null);
                toast.success(`${updated.name} package saved`);
              }}
            />
          ) : (
            <PackageCard key={p.id} pkg={p} onEdit={() => setEditingId(p.id)} />
          ),
        )}
        {adding && (
          <PackageEditor
            initial={{
              id: "",
              name: "",
              priceMonthly: 0,
              includes: [],
              activeClients: 0,
              color: "bg-primary",
            }}
            isNew
            onCancel={() => setAdding(false)}
            onSave={(created) => {
              const id =
                created.name.trim().toLowerCase().replace(/\s+/g, "-") || `package-${Date.now()}`;
              setPackages((cur) => [...cur, { ...created, id }]);
              setAdding(false);
              toast.success(`${created.name} package added`);
            }}
          />
        )}
      </div>
    </div>
  );
}

function PackageCard({ pkg, onEdit }: { pkg: PackageDef; onEdit: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", pkg.color)} />
          <h3 className="text-sm font-semibold">{pkg.name}</h3>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {pkg.activeClients} active
        </Badge>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        {fmtMoney(pkg.priceMonthly)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">/ mo</span>
      </p>
      <ul className="mt-3 space-y-1.5">
        {pkg.includes.map((line) => (
          <li key={line} className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="outline" className="mt-4 w-full" onClick={onEdit}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        Edit package
      </Button>
    </Card>
  );
}

function PackageEditor({
  initial,
  isNew,
  onSave,
  onCancel,
}: {
  initial: PackageDef;
  isNew?: boolean;
  onSave: (pkg: PackageDef) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState(String(initial.priceMonthly));
  const [features, setFeatures] = useState<string[]>(
    initial.includes.length ? initial.includes : [""],
  );

  const updateFeature = (i: number, v: string) => {
    setFeatures((cur) => cur.map((f, idx) => (idx === i ? v : f)));
  };
  const addFeature = () => setFeatures((cur) => [...cur, ""]);
  const removeFeature = (i: number) => setFeatures((cur) => cur.filter((_, idx) => idx !== i));

  const canSave = name.trim().length > 0 && Number(price) > 0;
  const fieldId = initial.id || "new";

  return (
    <Card className="p-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`pkg-name-${fieldId}`}>Package name</Label>
        <Input
          id={`pkg-name-${fieldId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Gold"
        />
      </div>
      <div className="mt-3 grid gap-1.5">
        <Label htmlFor={`pkg-price-${fieldId}`}>Price / month</Label>
        <Input
          id={`pkg-price-${fieldId}`}
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <div className="mt-3 grid gap-1.5">
        <Label>Included services</Label>
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={f}
              onChange={(e) => updateFeature(i, e.target.value)}
              placeholder="e.g. 2 meal plans / month"
              className="h-8 text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={features.length === 1}
              onClick={() => removeFeature(i)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="mt-1 w-fit" onClick={addFeature}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add line
        </Button>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!canSave}
          onClick={() =>
            onSave({
              ...initial,
              name: name.trim(),
              priceMonthly: Number(price),
              includes: features.map((f) => f.trim()).filter(Boolean),
            })
          }
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {isNew ? "Add package" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

/* ---------- Services (group class types) ----------
 * Backed by a real endpoint (GET/PATCH /api/settings/class-types) — this is the one Settings
 * tab that isn't mock-only. It's also what the New Appointment dialog's Group class dropdown
 * reads from (@/lib/settings-api, same fetchClassTypes query key), so an edit saved here shows
 * up there on next fetch — no separate hardcoded list to keep in sync.
 */

function ServicesTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings", "class-types"],
    queryFn: fetchClassTypes,
  });

  const [types, setTypes] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setTypes(data);
      setDirty(false);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (next: string[]) => updateClassTypes(next),
    onSuccess: (saved) => {
      qc.setQueryData(["settings", "class-types"], saved);
      setDirty(false);
      toast.success("Class types saved");
    },
  });

  const updateType = (i: number, v: string) => {
    setTypes((cur) => cur.map((t, idx) => (idx === i ? v : t)));
    setDirty(true);
  };
  const removeType = (i: number) => {
    setTypes((cur) => cur.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const addType = () => {
    setTypes((cur) => [...cur, ""]);
    setDirty(true);
  };

  const canSave = dirty && types.length > 0 && types.every((t) => t.trim().length > 0);

  return (
    <div className="grid gap-4">
      <Section
        title="Group class types"
        description="The options shown in the Group class dropdown when scheduling a new appointment."
        footer={
          <Button
            size="sm"
            disabled={!canSave || mutation.isPending}
            onClick={() => mutation.mutate(types.map((t) => t.trim()))}
          >
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load class types.</p>
        ) : (
          <div className="grid gap-2">
            {types.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={t}
                  onChange={(e) => updateType(i, e.target.value)}
                  placeholder="e.g. Pilates"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={types.length === 1}
                  onClick={() => removeType(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-fit" onClick={addType}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add class type
            </Button>
          </div>
        )}
        {mutation.isError && (
          <p className="mt-2 text-xs text-destructive">{(mutation.error as Error).message}</p>
        )}
      </Section>
    </div>
  );
}

/* ---------- Security ---------- */

function SecurityTab() {
  const [twoFA, setTwoFA] = useState(true);

  return (
    <div className="grid gap-4">
      <Section title="Sign-in & 2FA" description="Protect your owner account.">
        <Row label="Password" hint="Last changed 3 months ago">
          <Button variant="outline" size="sm">
            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
            Change password
          </Button>
        </Row>
        <Separator />
        <Row label="Two-factor authentication" hint="Authenticator app — required for owners">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                twoFA
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-700",
              )}
            >
              {twoFA ? "Enabled" : "Disabled"}
            </Badge>
            <Switch
              checked={twoFA}
              onCheckedChange={(v) => {
                setTwoFA(v);
                toast.success(v ? "2FA enabled" : "2FA disabled");
              }}
            />
          </div>
        </Row>
        <Separator />
        <Row label="Backup codes" hint="One-time codes if you lose your device">
          <Button variant="outline" size="sm">
            Regenerate
          </Button>
        </Row>
      </Section>
    </div>
  );
}
