import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Calendar,
  Target,
  Activity,
  Flame,
  Utensils,
  Dumbbell,
  Scale,
  FileText,
  Image as ImageIcon,
  TestTube,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Download,
  Lock,
  Loader2,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ServiceBadge } from "@/components/service-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bmiBand, calcBMI, type ClientRecord } from "@/lib/clients-mock";
import { fetchClient } from "@/lib/clients-api";
import { fetchMealPlans } from "@/lib/mealplans-api";
import { NewPlanDialog } from "@/components/new-plan-dialog";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({
    meta: [{ title: "Client — Nutria" }],
  }),
  component: ClientDetailPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl text-center py-20">
      <h1 className="font-display text-2xl font-semibold">Client not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This client may have been removed or the link is incorrect.
      </p>
      <Button asChild className="mt-6">
        <Link to="/clients">Back to clients</Link>
      </Button>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl text-center py-20">
      <h1 className="font-display text-2xl font-semibold">Couldn't load client</h1>
      <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
    </div>
  ),
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient(clientId),
  });

  if (isLoading || !client) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const bmi = calcBMI(client);
  const band = bmiBand(bmi);
  const weightDelta = client.weightKg - client.startWeightKg;
  const remainingKg = client.weightKg - client.targetWeightKg;

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All clients
      </Link>

      {/* Identity header */}
      <Card className="border-border/70 shadow-soft overflow-hidden">
        <div className="h-2 bg-linear-to-r from-primary via-primary/70 to-accent" />
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary-soft text-primary text-lg font-semibold">
                  {client.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold tracking-tight">
                    {client.name}
                  </h1>
                  <ServiceBadge types={client.serviceType} />
                  <StatusPill status={client.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {client.age} · {client.sex === "F" ? "Female" : "Male"} · {client.occupation}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {client.phone}
                  </span>
                  {client.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> {client.email}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Joined {formatDate(client.joinedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </Button>
              <Button size="sm" onClick={() => setNewPlanOpen(true)}>
                <Plus className="h-4 w-4" /> New plan
              </Button>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* At-a-glance metrics */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric
              label="Current weight"
              value={`${client.weightKg.toFixed(1)} kg`}
              hint={`${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)} kg from start`}
              tone={weightDelta < 0 ? "success" : weightDelta > 0 ? "warning" : "neutral"}
            />
            <Metric
              label="BMI"
              value={bmi.toFixed(1)}
              hint={band.label}
              tone={
                band.tone === "success"
                  ? "success"
                  : band.tone === "warning"
                    ? "warning"
                    : band.tone === "destructive"
                      ? "warning"
                      : "info"
              }
            />
            <Metric
              label="To goal"
              value={`${Math.abs(remainingKg).toFixed(1)} kg`}
              hint={remainingKg > 0 ? "remaining" : "at or below target"}
              tone="info"
            />
            <Metric
              label="Daily target"
              value={`${client.targets.calories.toLocaleString()} kcal`}
              hint={`P ${client.targets.protein} · C ${client.targets.carbs} · F ${client.targets.fat}`}
              tone="primary"
            />
            <Metric
              label="Adherence (30d)"
              value={`${client.adherencePct}%`}
              hint={
                client.adherencePct >= 85
                  ? "excellent"
                  : client.adherencePct >= 70
                    ? "good"
                    : "needs attention"
              }
              tone={
                client.adherencePct >= 85
                  ? "success"
                  : client.adherencePct >= 70
                    ? "info"
                    : "warning"
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="mt-6">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="clinical">
            <Lock className="h-3 w-3" />
            Clinical
          </TabsTrigger>
          <TabsTrigger value="nutrition">Daily nutrition</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="goals">Goals & targets</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-5">
          <ProfileTab c={client} />
        </TabsContent>
        <TabsContent value="clinical" className="mt-5">
          <ClinicalTab c={client} />
        </TabsContent>
        <TabsContent value="nutrition" className="mt-5">
          <NutritionTab c={client} />
        </TabsContent>
        <TabsContent value="journal" className="mt-5">
          <JournalTab c={client} />
        </TabsContent>
        <TabsContent value="plans" className="mt-5">
          <PlansTab c={client} />
        </TabsContent>
        <TabsContent value="goals" className="mt-5">
          <GoalsTab c={client} />
        </TabsContent>
        <TabsContent value="reports" className="mt-5">
          <ReportsTab c={client} />
        </TabsContent>
        <TabsContent value="billing" className="mt-5">
          <BillingTab c={client} />
        </TabsContent>
        <TabsContent value="files" className="mt-5">
          <FilesTab c={client} />
        </TabsContent>
      </Tabs>

      <NewPlanDialog
        open={newPlanOpen}
        onOpenChange={setNewPlanOpen}
        initialClient={client}
        onCreate={() => {
          qc.invalidateQueries({ queryKey: ["mealplans", "client", clientId] });
        }}
      />
    </div>
  );
}

/* ---------- Reusable bits ---------- */

function StatusPill({ status }: { status: ClientRecord["status"] }) {
  const styles =
    status === "active"
      ? "bg-success/10 text-success border-success/30"
      : status === "paused"
        ? "bg-warning/15 text-warning-foreground border-warning/40"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

type Tone = "success" | "warning" | "info" | "primary" | "neutral";
function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}) {
  const toneClass: Record<Tone, string> = {
    success: "text-success",
    warning: "text-warning-foreground",
    info: "text-info",
    primary: "text-primary",
    neutral: "text-foreground",
  };
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-xl font-semibold tabular-nums ${toneClass[tone]}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-border/70 shadow-soft">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div>
            <CardTitle className="font-display text-base">{title}</CardTitle>
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function TagList({ items, empty = "—" }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <span className="text-sm text-muted-foreground">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <Badge key={t} variant="secondary" className="font-normal">
          {t}
        </Badge>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ---------- Tabs ---------- */

function ProfileTab({ c }: { c: ClientRecord }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Anthropometrics" icon={Scale}>
        <div className="space-y-0">
          <KV label="Height" value={`${c.heightCm} cm`} />
          <KV label="Weight" value={`${c.weightKg.toFixed(1)} kg`} />
          <KV label="Starting weight" value={`${c.startWeightKg.toFixed(1)} kg`} />
          <KV label="Target weight" value={`${c.targetWeightKg.toFixed(1)} kg`} />
          <KV label="BMI" value={`${calcBMI(c).toFixed(1)} · ${bmiBand(calcBMI(c)).label}`} />
        </div>
      </SectionCard>

      <SectionCard title="Lifestyle" icon={Activity}>
        <div className="space-y-0">
          <KV label="Occupation" value={c.occupation} />
          <KV label="Activity factor" value={c.activityFactor.toFixed(3)} />
          <KV label="Sleep" value={`${c.sleepHours} h / night`} />
          <KV label="Joined" value={formatDate(c.joinedAt)} />
        </div>
      </SectionCard>

      <SectionCard title="Dietary preferences" icon={Utensils}>
        <TagList items={c.dietaryPrefs} empty="No preferences recorded" />
      </SectionCard>

      <SectionCard title="Allergies & intolerances" icon={AlertTriangle}>
        <TagList items={c.allergies} empty="None reported" />
      </SectionCard>
    </div>
  );
}

function ClinicalTab({ c }: { c: ClientRecord }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
        <Lock className="h-4 w-4 text-warning-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Private — clinician view only.</span>{" "}
          Visible to Lead Dietitian and Dietitian roles. Never shared with the client.
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Medical history" icon={FileText}>
          {c.medicalHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No significant history reported.</p>
          ) : (
            <ul className="space-y-2">
              {c.medicalHistory.map((m) => (
                <li key={m} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-1 shrink-0" />
                  {m}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Lab values"
          icon={TestTube}
          action={
            <Button variant="ghost" size="sm">
              Add
            </Button>
          }
        >
          {c.labs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No labs on file.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 px-0">Marker</TableHead>
                  <TableHead className="h-8 text-right">Value</TableHead>
                  <TableHead className="h-8 text-right">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.labs.map((l) => (
                  <TableRow key={l.name} className="hover:bg-transparent">
                    <TableCell className="px-0 py-2 font-medium">{l.name}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{l.value}</TableCell>
                    <TableCell className="py-2 text-right text-xs text-muted-foreground">
                      {l.reference}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard title="Nutrition diagnosis" description="PES-style statement" icon={FileText}>
          <p className="text-sm leading-relaxed">{c.nutritionDiagnosis}</p>
        </SectionCard>

        <SectionCard
          title="ADIME monitoring notes"
          icon={FileText}
          action={
            <Button variant="ghost" size="sm">
              Add note
            </Button>
          }
        >
          {c.adimeNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {c.adimeNotes.map((n) => (
                <li key={n.date} className="border-l-2 border-primary/40 pl-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {formatDate(n.date)}
                  </p>
                  <p className="text-sm">{n.note}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function NutritionTab({ c }: { c: ClientRecord }) {
  const consumedPct =
    c.targets.calories === 0
      ? 0
      : Math.round((c.todayConsumed.calories / c.targets.calories) * 100);
  const macros = [
    {
      label: "Protein",
      current: c.todayConsumed.protein,
      target: c.targets.protein,
      color: "bg-chart-1",
    },
    {
      label: "Carbs",
      current: c.todayConsumed.carbs,
      target: c.targets.carbs,
      color: "bg-chart-3",
    },
    { label: "Fat", current: c.todayConsumed.fat, target: c.targets.fat, color: "bg-chart-4" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard title="Today" icon={Flame} description="Calories vs. target">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold tabular-nums">
            {c.todayConsumed.calories.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            / {c.targets.calories.toLocaleString()} kcal
          </span>
        </div>
        <Progress value={consumedPct} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {Math.max(c.targets.calories - c.todayConsumed.calories, 0)} kcal remaining ·{" "}
          {consumedPct}% of target
        </p>
      </SectionCard>

      <SectionCard title="Macros today" icon={Utensils}>
        <div className="space-y-4">
          {macros.map((m) => {
            const pct = m.target === 0 ? 0 : Math.round((m.current / m.target) * 100);
            return (
              <div key={m.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {m.current}g / {m.target}g
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${m.color}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Exercise today" icon={Dumbbell}>
        {c.journal.filter((j) => j.kind === "exercise").length === 0 ? (
          <p className="text-sm text-muted-foreground">No exercise logged today.</p>
        ) : (
          <ul className="space-y-2">
            {c.journal
              .filter((j) => j.kind === "exercise")
              .map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{e.detail}</p>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function JournalTab({ c }: { c: ClientRecord }) {
  if (c.journal.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No journal entries yet. Logs from WhatsApp will appear here automatically.
        </CardContent>
      </Card>
    );
  }
  const byDate = c.journal.reduce<Record<string, typeof c.journal>>((acc, j) => {
    (acc[j.date] = acc[j.date] || []).push(j);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {Object.entries(byDate).map(([date, entries]) => (
        <div key={date}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {formatDate(date)}
          </h3>
          <Card className="border-border/70 shadow-soft">
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
                      {e.kind === "meal" && <Utensils className="h-4 w-4" />}
                      {e.kind === "exercise" && <Dumbbell className="h-4 w-4" />}
                      {e.kind === "weight" && <Scale className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{e.title}</p>
                        {e.flagged && (
                          <Badge
                            variant="outline"
                            className="border-warning/40 bg-warning/10 text-warning-foreground text-[10px]"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" /> Flagged
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{e.detail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground tabular-nums">{e.time}</p>
                      {e.kcal !== undefined && (
                        <p className="text-sm font-semibold tabular-nums">{e.kcal} kcal</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

function PlansTab({ c }: { c: ClientRecord }) {
  const { data, isLoading } = useQuery({
    queryKey: ["mealplans", "client", c.id],
    queryFn: () => fetchMealPlans({ client: c.id, limit: 100 }),
  });
  const plans = data?.plans ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm">
          <Plus className="h-4 w-4" /> Assign plan
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No plans assigned yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.id} className="border-border/70 shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.startDate)}
                      {p.endDate ? ` → ${formatDate(p.endDate)}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      p.status === "active"
                        ? "border-success/30 bg-success/10 text-success capitalize"
                        : p.status === "draft"
                          ? "border-info/30 bg-info/10 text-info capitalize"
                          : "border-border bg-muted text-muted-foreground capitalize"
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Daily target</p>
                    <p className="font-display text-base font-semibold">
                      {p.targets.kcal.toLocaleString()} kcal
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Open plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalsTab({ c }: { c: ClientRecord }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Primary goal" icon={Target}>
        <div className="space-y-0">
          <KV
            label="Type"
            value={<span className="capitalize">{c.goal.type.replace("-", " ")}</span>}
          />
          <KV
            label="Target weight"
            value={c.goal.targetWeight ? `${c.goal.targetWeight.toFixed(1)} kg` : "—"}
          />
          <KV label="Target date" value={c.goal.targetDate ? formatDate(c.goal.targetDate) : "—"} />
        </div>
      </SectionCard>

      <SectionCard
        title="Energy targets"
        icon={Flame}
        description="Mifflin-St Jeor × activity factor, editable"
      >
        <div className="space-y-0">
          <KV label="BMR" value={`${c.bmr.toLocaleString()} kcal`} />
          <KV label="Activity factor" value={c.activityFactor.toFixed(3)} />
          <KV label="Daily target" value={`${c.targets.calories.toLocaleString()} kcal`} />
          <KV label="Protein" value={`${c.targets.protein} g`} />
          <KV label="Carbs" value={`${c.targets.carbs} g`} />
          <KV label="Fat" value={`${c.targets.fat} g`} />
        </div>
        <Button variant="outline" size="sm" className="mt-4 w-full">
          Edit targets
        </Button>
      </SectionCard>
    </div>
  );
}

function ReportsTab({ c }: { c: ClientRecord }) {
  const items = [
    { label: "This week", range: "Jun 10 – Jun 16", calories: 1442, adherence: c.adherencePct },
    { label: "Last week", range: "Jun 3 – Jun 9", calories: 1521, adherence: 84 },
    { label: "Month-to-date", range: "Jun 1 – Jun 17", calories: 1488, adherence: 86 },
  ];
  return (
    <div className="space-y-3">
      {items.map((r) => (
        <Card key={r.label} className="border-border/70 shadow-soft">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-display text-base font-semibold">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.range}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Avg kcal</p>
                <p className="font-semibold tabular-nums">{r.calories.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Adherence</p>
                <p className="font-semibold tabular-nums">{r.adherence}%</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BillingTab({ c }: { c: ClientRecord }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          label="Outstanding"
          value={`$${c.outstandingBalanceUsd}`}
          hint={c.outstandingBalanceUsd > 0 ? "due" : "all settled"}
          tone={c.outstandingBalanceUsd > 0 ? "warning" : "success"}
        />
        <Metric
          label="Last payment"
          value={c.payments[0] ? `$${c.payments[0].amount}` : "—"}
          hint={c.payments[0] ? formatDate(c.payments[0].date) : "no payments"}
          tone="info"
        />
        <Metric
          label="Active package"
          value={c.payments[0]?.package ?? "—"}
          hint="auto-renews monthly"
          tone="primary"
        />
      </div>

      <Card className="border-border/70 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display text-base">Payment history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {c.payments.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No payments on file.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Date</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell>{p.package}</TableCell>
                    <TableCell className="text-right tabular-nums">${p.amount}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          p.status === "paid"
                            ? "border-success/30 bg-success/10 text-success capitalize"
                            : p.status === "due"
                              ? "border-warning/30 bg-warning/10 text-warning-foreground capitalize"
                              : "border-destructive/30 bg-destructive/10 text-destructive capitalize"
                        }
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilesTab({ c }: { c: ClientRecord }) {
  if (c.files.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No files uploaded yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {c.files.map((f) => (
        <Card key={f.id} className="border-border/70 shadow-soft">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
              {f.kind === "lab" && <TestTube className="h-4 w-4" />}
              {f.kind === "photo" && <ImageIcon className="h-4 w-4" />}
              {f.kind === "document" && <FileText className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(f.uploadedAt)} · {Math.round(f.sizeKb)} KB
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <Download className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
