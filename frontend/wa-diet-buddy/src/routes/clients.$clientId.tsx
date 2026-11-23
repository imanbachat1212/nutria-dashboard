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
  Pill,
} from "lucide-react";

import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

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
import { useFormatters, type Formatters } from "@/lib/i18n/format";
import {
  bmiBand,
  calcBMI,
  DRI_VITAMIN_FIELDS,
  DRI_MINERAL_FIELDS,
  type ClientRecord,
} from "@/lib/clients-mock";
import { fetchClient } from "@/lib/clients-api";
import { fetchMealPlans } from "@/lib/mealplans-api";
import { NewPlanDialog } from "@/components/new-plan-dialog";

export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({
    meta: [{ title: "Client — Nutria" }],
  }),
  component: ClientDetailPage,
  // Named components rather than inline arrows: these render as siblings of ClientDetailPage,
  // not inside it, so each needs its own useTranslation call.
  notFoundComponent: ClientNotFound,
  errorComponent: ClientLoadError,
});

function ClientNotFound() {
  const { t } = useTranslation("clients");
  return (
    <div className="mx-auto max-w-3xl text-center py-20">
      <h1 className="font-display text-2xl font-semibold">{t("detail.notFound")}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t("detail.notFoundBody")}</p>
      <Button asChild className="mt-6">
        <Link to="/clients">{t("detail.backToClients")}</Link>
      </Button>
    </div>
  );
}

function ClientLoadError({ error }: { error: Error }) {
  const { t } = useTranslation("clients");
  return (
    <div className="mx-auto max-w-3xl text-center py-20">
      <h1 className="font-display text-2xl font-semibold">{t("detail.loadFailed")}</h1>
      {/* The server's own message, shown as the server sends it. */}
      <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
    </div>
  );
}

function ClientDetailPage() {
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
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
                  {client.age} ·{" "}
                  {client.sex === "F" ? t("clients:detail.sexFemale") : t("clients:detail.sexMale")}{" "}
                  · {client.occupation}
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
                    <Calendar className="h-3 w-3" />{" "}
                    {t("clients:detail.joined", { date: formatDate(client.joinedAt, fmt) })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4" /> {t("clients:detail.whatsapp")}
              </Button>
              <Button size="sm" onClick={() => setNewPlanOpen(true)}>
                <Plus className="h-4 w-4" /> {t("clients:detail.newPlan")}
              </Button>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* At-a-glance metrics */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric
              label={t("clients:detail.metrics.currentWeight")}
              value={`${client.weightKg.toFixed(1)} kg`}
              hint={t("clients:detail.metrics.fromStart", {
                delta: `${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)}`,
              })}
              tone={weightDelta < 0 ? "success" : weightDelta > 0 ? "warning" : "neutral"}
            />
            <Metric
              label={t("clients:detail.metrics.bmi")}
              value={bmi.toFixed(1)}
              hint={t(`clients:detail.bmiBand.${band.labelKey}`)}
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
              label={t("clients:detail.metrics.toGoal")}
              value={`${Math.abs(remainingKg).toFixed(1)} kg`}
              hint={
                remainingKg > 0
                  ? t("clients:detail.metrics.remaining")
                  : t("clients:detail.metrics.atOrBelow")
              }
              tone="info"
            />
            <Metric
              label={t("clients:detail.metrics.dailyTarget")}
              value={t("common:units.kcalValue", { value: fmt.number(client.targets.calories) })}
              hint={t("clients:detail.metrics.macroHint", {
                protein: client.targets.protein,
                carbs: client.targets.carbs,
                fat: client.targets.fat,
              })}
              tone="primary"
            />
            <Metric
              label={t("clients:detail.metrics.adherence")}
              value={`${client.adherencePct}%`}
              hint={
                client.adherencePct >= 85
                  ? t("clients:detail.metrics.excellent")
                  : client.adherencePct >= 70
                    ? t("clients:detail.metrics.good")
                    : t("clients:detail.metrics.needsAttention")
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
          <TabsTrigger value="profile">{t("clients:detail.tabs.profile")}</TabsTrigger>
          <TabsTrigger value="clinical">
            <Lock className="h-3 w-3" />
            {t("clients:detail.tabs.clinical")}
          </TabsTrigger>
          <TabsTrigger value="nutrition">{t("clients:detail.tabs.nutrition")}</TabsTrigger>
          <TabsTrigger value="journal">{t("clients:detail.tabs.journal")}</TabsTrigger>
          <TabsTrigger value="plans">{t("clients:detail.tabs.plans")}</TabsTrigger>
          <TabsTrigger value="goals">{t("clients:detail.tabs.goals")}</TabsTrigger>
          <TabsTrigger value="reports">{t("clients:detail.tabs.reports")}</TabsTrigger>
          <TabsTrigger value="billing">{t("clients:detail.tabs.billing")}</TabsTrigger>
          <TabsTrigger value="files">{t("clients:detail.tabs.files")}</TabsTrigger>
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
  const { t } = useTranslation("clients");
  const styles =
    status === "active"
      ? "bg-success/10 text-success border-success/30"
      : status === "paused"
        ? "bg-warning/15 text-warning-foreground border-warning/40"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      // `capitalize` is gone with the raw enum it was there to tidy up.
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles}`}
    >
      {t(`status.${status}`)}
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
      <span className="text-sm font-medium text-end">{value}</span>
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

// Was pinned to "en-US". Takes the active formatter so the Arabic page does not show English
// month abbreviations in a dozen places.
function formatDate(iso: string, fmt: Formatters) {
  if (!iso) return "—";
  return fmt.date(iso, { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- Tabs ---------- */

function ProfileTab({ c }: { c: ClientRecord }) {
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title={t("clients:detail.profile.anthropometrics")} icon={Scale}>
        <div className="space-y-0">
          <KV
            label={t("clients:detail.profile.height")}
            value={`${c.heightCm} ${t("common:units.cm")}`}
          />
          <KV
            label={t("clients:detail.profile.weight")}
            value={`${c.weightKg.toFixed(1)} ${t("common:units.kg")}`}
          />
          <KV
            label={t("clients:detail.profile.startingWeight")}
            value={`${c.startWeightKg.toFixed(1)} ${t("common:units.kg")}`}
          />
          <KV
            label={t("clients:detail.profile.targetWeight")}
            value={`${c.targetWeightKg.toFixed(1)} ${t("common:units.kg")}`}
          />
          <KV
            label={t("clients:detail.metrics.bmi")}
            value={`${calcBMI(c).toFixed(1)} · ${t(`clients:detail.bmiBand.${bmiBand(calcBMI(c)).labelKey}`)}`}
          />
        </div>
      </SectionCard>

      <SectionCard title={t("clients:detail.profile.lifestyle")} icon={Activity}>
        <div className="space-y-0">
          <KV label={t("clients:detail.profile.occupation")} value={c.occupation} />
          <KV
            label={t("clients:detail.profile.activityFactor")}
            value={c.activityFactor.toFixed(3)}
          />
          <KV
            label={t("clients:detail.profile.sleep")}
            value={t("clients:detail.profile.sleepValue", { hours: c.sleepHours })}
          />
          <KV label={t("clients:detail.profile.joined")} value={formatDate(c.joinedAt, fmt)} />
        </div>
      </SectionCard>

      <SectionCard title={t("clients:detail.profile.dietaryPrefs")} icon={Utensils}>
        <TagList items={c.dietaryPrefs} empty={t("clients:detail.profile.noPrefs")} />
      </SectionCard>

      <SectionCard title={t("clients:detail.profile.allergies")} icon={AlertTriangle}>
        <TagList items={c.allergies} empty={t("clients:detail.profile.noAllergies")} />
      </SectionCard>
    </div>
  );
}

function ClinicalTab({ c }: { c: ClientRecord }) {
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
        <Lock className="h-4 w-4 text-warning-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("clients:detail.clinical.privateTitle")}
          </span>{" "}
          {t("clients:detail.clinical.privateBody")}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t("clients:detail.clinical.medicalHistory")} icon={FileText}>
          {c.medicalHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("clients:detail.clinical.noHistory")}
            </p>
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
          title={t("clients:detail.clinical.labs")}
          icon={TestTube}
          action={
            <Button variant="ghost" size="sm">
              {t("clients:detail.clinical.addLab")}
            </Button>
          }
        >
          {c.labs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("clients:detail.clinical.noLabs")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 px-0">{t("clients:detail.clinical.marker")}</TableHead>
                  <TableHead className="h-8 text-end">
                    {t("clients:detail.clinical.value")}
                  </TableHead>
                  <TableHead className="h-8 text-end">
                    {t("clients:detail.clinical.reference")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.labs.map((l) => (
                  <TableRow key={l.name} className="hover:bg-transparent">
                    <TableCell className="px-0 py-2 font-medium">{l.name}</TableCell>
                    <TableCell className="py-2 text-end tabular-nums">{l.value}</TableCell>
                    <TableCell className="py-2 text-end text-xs text-muted-foreground">
                      {l.reference}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          title={t("clients:detail.clinical.diagnosis")}
          description={t("clients:detail.clinical.diagnosisHint")}
          icon={FileText}
        >
          <p className="text-sm leading-relaxed">{c.nutritionDiagnosis}</p>
        </SectionCard>

        <SectionCard
          title={t("clients:detail.clinical.adime")}
          icon={FileText}
          action={
            <Button variant="ghost" size="sm">
              {t("clients:detail.clinical.addNote")}
            </Button>
          }
        >
          {c.adimeNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("clients:detail.clinical.noNotes")}</p>
          ) : (
            <ul className="space-y-3">
              {c.adimeNotes.map((n) => (
                <li key={n.date} className="border-s-2 border-primary/40 ps-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {formatDate(n.date, fmt)}
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
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
  const consumedPct =
    c.targets.calories === 0
      ? 0
      : Math.round((c.todayConsumed.calories / c.targets.calories) * 100);
  const macros = [
    {
      label: t("common:macros.protein"),
      current: c.todayConsumed.protein,
      target: c.targets.protein,
      color: "bg-chart-1",
    },
    {
      label: t("common:macros.carbs"),
      current: c.todayConsumed.carbs,
      target: c.targets.carbs,
      color: "bg-chart-3",
    },
    {
      label: t("common:macros.fat"),
      current: c.todayConsumed.fat,
      target: c.targets.fat,
      color: "bg-chart-4",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard
        title={t("clients:detail.nutrition.today")}
        icon={Flame}
        description={t("clients:detail.nutrition.todayHint")}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold tabular-nums">
            {fmt.number(c.todayConsumed.calories)}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("clients:detail.nutrition.ofTarget", { total: fmt.number(c.targets.calories) })}
          </span>
        </div>
        <Progress value={consumedPct} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {t("clients:detail.nutrition.remaining", {
            kcal: fmt.number(Math.max(c.targets.calories - c.todayConsumed.calories, 0)),
            percent: consumedPct,
          })}
        </p>
      </SectionCard>

      <SectionCard title={t("clients:detail.nutrition.macrosToday")} icon={Utensils}>
        <div className="space-y-4">
          {macros.map((m) => {
            const pct = m.target === 0 ? 0 : Math.round((m.current / m.target) * 100);
            return (
              <div key={m.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t("clients:detail.nutrition.macroProgress", {
                      current: m.current,
                      target: m.target,
                    })}
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

      <SectionCard title={t("clients:detail.nutrition.exerciseToday")} icon={Dumbbell}>
        {c.journal.filter((j) => j.kind === "exercise").length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("clients:detail.nutrition.noExercise")}
          </p>
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
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
  if (c.journal.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t("clients:detail.journal.empty")}
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
            {formatDate(date, fmt)}
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
                            <AlertTriangle className="h-2.5 w-2.5" />{" "}
                            {t("clients:detail.journal.flagged")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{e.detail}</p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-xs text-muted-foreground tabular-nums">{e.time}</p>
                      {e.kcal !== undefined && (
                        <p className="text-sm font-semibold tabular-nums">
                          {t("common:units.kcalValue", { value: e.kcal })}
                        </p>
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
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
  const { data, isLoading } = useQuery({
    queryKey: ["mealplans", "client", c.id],
    queryFn: () => fetchMealPlans({ client: c.id, limit: 100 }),
  });
  const plans = data?.plans ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm">
          <Plus className="h-4 w-4" /> {t("clients:detail.plans.assign")}
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("clients:detail.plans.empty")}
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
                      {formatDate(p.startDate, fmt)}
                      {p.endDate ? ` → ${formatDate(p.endDate, fmt)}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      p.status === "active"
                        ? "border-success/30 bg-success/10 text-success"
                        : p.status === "draft"
                          ? "border-info/30 bg-info/10 text-info"
                          : "border-border bg-muted text-muted-foreground"
                    }
                  >
                    {t(`clients:detail.plans.status.${p.status}`)}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("clients:detail.plans.dailyTarget")}
                    </p>
                    <p className="font-display text-base font-semibold">
                      {t("common:units.kcalValue", { value: fmt.number(p.targets.kcal) })}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    {t("clients:detail.plans.open")}
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
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title={t("clients:detail.goals.primary")} icon={Target}>
        <div className="space-y-0">
          <KV
            label={t("clients:detail.goals.type")}
            // Was the raw enum with the hyphen swapped for a space and CSS capitalize.
            value={t(`clients:detail.goalType.${c.goal.type}`)}
          />
          <KV
            label={t("clients:detail.goals.targetWeight")}
            value={
              c.goal.targetWeight
                ? `${c.goal.targetWeight.toFixed(1)} ${t("common:units.kg")}`
                : "—"
            }
          />
          <KV
            label={t("clients:detail.goals.targetDate")}
            value={c.goal.targetDate ? formatDate(c.goal.targetDate, fmt) : "—"}
          />
        </div>
      </SectionCard>

      <SectionCard
        title={t("clients:detail.goals.energy")}
        icon={Flame}
        description={t("clients:detail.goals.energyHint")}
      >
        <div className="space-y-0">
          <KV
            // Kept as the acronym in both languages — Lebanese dietitians use "BMR" in Arabic
            // conversation too, and "معدل الأيض الأساسي" does not fit this label column. Listed
            // for native review in GLOSSARY.md.
            label={t("clients:detail.goals.bmr")}
            value={t("common:units.kcalValue", { value: fmt.number(c.bmr) })}
          />
          <KV
            label={t("clients:detail.profile.activityFactor")}
            value={c.activityFactor.toFixed(3)}
          />
          <KV
            label={t("clients:detail.metrics.dailyTarget")}
            value={t("common:units.kcalValue", { value: fmt.number(c.targets.calories) })}
          />
          <KV
            label={t("common:macros.protein")}
            value={t("common:units.gramValue", { value: c.targets.protein })}
          />
          <KV
            label={t("common:macros.carbs")}
            value={t("common:units.gramValue", { value: c.targets.carbs })}
          />
          <KV
            label={t("common:macros.fat")}
            value={t("common:units.gramValue", { value: c.targets.fat })}
          />
        </div>
        <Button variant="outline" size="sm" className="mt-4 w-full">
          Edit targets
        </Button>
      </SectionCard>

      <SectionCard
        title={t("clients:detail.goals.dri")}
        icon={Pill}
        description={t("clients:detail.goals.driHint")}
        action={
          c.driTargets?.method === "manual" && (
            <Badge variant="outline" className="text-[10px]">
              Manual
            </Badge>
          )
        }
      >
        {!c.driTargets ? (
          <p className="text-xs text-muted-foreground">
            Not yet computed — needs date of birth and sex on the client's profile.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Vitamins
              </div>
              <div className="space-y-0">
                {DRI_VITAMIN_FIELDS.map((f) => (
                  <KV
                    key={f.key}
                    label={f.label}
                    value={c.driTargets?.[f.key] != null ? `${c.driTargets[f.key]} ${f.unit}` : "—"}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Minerals
              </div>
              <div className="space-y-0">
                {DRI_MINERAL_FIELDS.map((f) => (
                  <KV
                    key={f.key}
                    label={f.label}
                    value={c.driTargets?.[f.key] != null ? `${c.driTargets[f.key]} ${f.unit}` : "—"}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function ReportsTab({ c }: { c: ClientRecord }) {
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
  const items = [
    {
      label: t("clients:detail.reports.thisWeek"),
      range: "Jun 10 – Jun 16",
      calories: 1442,
      adherence: c.adherencePct,
    },
    {
      label: t("clients:detail.reports.lastWeek"),
      range: "Jun 3 – Jun 9",
      calories: 1521,
      adherence: 84,
    },
    {
      label: t("clients:detail.reports.monthToDate"),
      range: "Jun 1 – Jun 17",
      calories: 1488,
      adherence: 86,
    },
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
              <div className="text-end">
                <p className="text-xs text-muted-foreground">
                  {t("clients:detail.reports.avgKcal")}
                </p>
                <p className="font-semibold tabular-nums">{fmt.number(r.calories)}</p>
              </div>
              <div className="text-end">
                <p className="text-xs text-muted-foreground">
                  {t("clients:detail.reports.adherence")}
                </p>
                <p className="font-semibold tabular-nums">{r.adherence}%</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" /> {t("clients:detail.reports.downloadPdf")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BillingTab({ c }: { c: ClientRecord }) {
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          label={t("clients:detail.billing.outstanding")}
          value={`$${c.outstandingBalanceUsd}`}
          hint={
            c.outstandingBalanceUsd > 0
              ? t("clients:detail.billing.due")
              : t("clients:detail.billing.allSettled")
          }
          tone={c.outstandingBalanceUsd > 0 ? "warning" : "success"}
        />
        <Metric
          label={t("clients:detail.billing.lastPayment")}
          value={c.payments[0] ? `$${c.payments[0].amount}` : "—"}
          hint={
            c.payments[0]
              ? formatDate(c.payments[0].date, fmt)
              : t("clients:detail.billing.noPayments")
          }
          tone="info"
        />
        <Metric
          label={t("clients:detail.billing.activePackage")}
          value={c.payments[0]?.package ?? "—"}
          hint={t("clients:detail.billing.autoRenews")}
          tone="primary"
        />
      </div>

      <Card className="border-border/70 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display text-base">
            {t("clients:detail.billing.history")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {c.payments.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              {t("clients:detail.billing.noHistory")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>{t("clients:detail.billing.date")}</TableHead>
                  <TableHead>{t("clients:detail.billing.package")}</TableHead>
                  <TableHead className="text-end">{t("clients:detail.billing.amount")}</TableHead>
                  <TableHead className="text-end">
                    {t("clients:detail.billing.statusColumn")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.date, fmt)}</TableCell>
                    <TableCell>{p.package}</TableCell>
                    <TableCell className="text-end tabular-nums">${p.amount}</TableCell>
                    <TableCell className="text-end">
                      <Badge
                        variant="outline"
                        className={
                          p.status === "paid"
                            ? "border-success/30 bg-success/10 text-success"
                            : p.status === "due"
                              ? "border-warning/30 bg-warning/10 text-warning-foreground"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                        }
                      >
                        {t(`clients:detail.billing.status.${p.status}`)}
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
  const { t } = useTranslation(["clients", "common"]);
  const fmt = useFormatters();
  if (c.files.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t("clients:detail.files.empty")}
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
                {formatDate(f.uploadedAt, fmt)} · {Math.round(f.sizeKb)} KB
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
