import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Users,
  CalendarDays,
  Database,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Utensils,
  Dumbbell,
  Activity,
  Loader2,
  WifiOff,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { ltrIsolate, useFormatters, useRelativeTime } from "@/lib/i18n/format";
import {
  fetchOverview,
  type ActivityType,
  type Overview,
  type OverviewTrend,
} from "@/lib/overview-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Nutria" },
      {
        name: "description",
        content: "Daily snapshot of your dietetics practice: active clients, plans, food database, and today's activity.",
      },
    ],
  }),
  component: OverviewPage,
});

// ── Header ─────────────────────────────────────────────────────────────────────────────────────

// "Tuesday, June 17" — the same shape as the literal this replaced, from a real date.
//
// Built from the payload's `today.date` (the server's Beirut day) rather than the browser's clock,
// so the eyebrow can't name a different day from the numbers underneath it. Parsed without a `Z`
// on purpose: that makes it a local midnight, which formats back to the same calendar date instead
// of shifting a day for viewers behind UTC.
function formatEyebrow(ymd: string | undefined, fmt: ReturnType<typeof useFormatters>): string {
  const d = ymd ? new Date(`${ymd}T00:00:00`) : new Date();
  // Was pinned to "en-US", which would have left this one line English on an Arabic page.
  return fmt.date(d, { weekday: "long", month: "long", day: "numeric" });
}

function greeting(name: string | undefined, t: TFunction): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  // The mock hardcoded "Good morning, Sura." — the name now comes from the logged-in user (already
  // in AuthProvider's context from /api/auth/me, so this costs no extra request) and the time of
  // day is real. First name only, which is how the greeting always read.
  //
  // Six keys rather than "Good {{part}}, {{name}}": Arabic has no shared "Good ___" frame — the
  // morning and evening greetings are unrelated phrases ("صباح الخير" / "مساء الخير"), and the
  // afternoon one is a different construction again. Interpolating the time of day would produce
  // nonsense in exactly the way machine translation does.
  const first = name?.trim().split(/\s+/)[0];
  return first
    ? t(`overview:greeting.${part}`, { name: first })
    : t(`overview:greeting.${part}NoName`);
}

// ── Stat row ───────────────────────────────────────────────────────────────────────────────────

function TrendBadge({
  trend,
  labelKey,
  windowDays,
}: {
  trend: OverviewTrend | null;
  // A whole-sentence key instead of the old `noun` fragment: "+3 new in 7d" cannot be assembled
  // from parts in Arabic, where the number, the noun and the window all move.
  labelKey: "trendNew" | "trendVsPrior";
  windowDays: number;
}) {
  const { t } = useTranslation("overview");
  // No honest comparison, no badge. Deliberately renders nothing rather than a "+0" or a
  // percentage over a zero baseline.
  if (!trend) return null;
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const sign = trend.delta > 0 ? "+" : "";
  const tone =
    trend.direction === "up"
      ? "bg-success/10 text-success"
      : trend.direction === "down"
        ? "bg-warning/10 text-warning-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={`gap-1 border-0 font-medium ${tone}`}>
      <Icon className="h-3 w-3" />
      {/* The sign travels INSIDE the isolated delta — "+3" / "-3" is one left-to-right token,
          not a neutral "+" that bidi can strand on the wrong side of the digits. */}
      {t(`stats.${labelKey}`, { delta: ltrIsolate(`${sign}${trend.delta}`), days: windowDays })}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  badge,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon className="h-5 w-5" />
          </div>
          {badge}
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-display text-3xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// "1,352 USDA + 81 Lebanese" — custom only appears once something is actually in it, so the hint
// doesn't advertise an empty bucket.
function foodsHint(
  bySource: Overview["stats"]["foods"]["bySource"],
  t: TFunction,
  fmt: ReturnType<typeof useFormatters>,
): string {
  const parts = [
    bySource.usda ? t("overview:foodsHint.usda", { count: fmt.number(bySource.usda) }) : null,
    bySource.lebanese ? t("overview:foodsHint.lebanese", { count: bySource.lebanese }) : null,
    bySource.custom ? t("overview:foodsHint.custom", { count: bySource.custom }) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" + ") : t("overview:foodsHint.empty");
}

// ── Activity feed ──────────────────────────────────────────────────────────────────────────────

// type → icon + wording, mapped here rather than sent from the backend: the payload carries a
// stable `type` string and this file owns how it reads.
// `actionKey` into the `overview` namespace — the TYPE strings on the left are API values and
// stay exactly as the backend sends them.
const ACTIVITY_META: Record<ActivityType, { icon: React.ComponentType<{ className?: string }>; actionKey: string }> = {
  "journal-meal": { icon: Utensils, actionKey: "activity.journalMeal" },
  "journal-exercise": { icon: Dumbbell, actionKey: "activity.journalExercise" },
  "lead-new": { icon: UserPlus, actionKey: "activity.leadNew" },
  "message-inbound": { icon: MessageSquare, actionKey: "activity.messageInbound" },
  "appointment-booked": { icon: CalendarDays, actionKey: "activity.appointmentBooked" },
};

// Appointment times read in UTC, deliberately.
//
// new-appointment-dialog.tsx stores the dietitian's chosen wall-clock time via `Date.UTC(...)`, so
// a booking entered as 09:00 sits in Mongo as 09:00Z; the Appointments page reads it back with
// getUTCHours(). Formatting in the browser's timezone here would show a Beirut viewer 12:00 for
// that same booking — a different number on two screens for one appointment. Same hours and
// minutes as appointments-mock.ts's formatTime, in 24h so it fits the compact time chip.
function appointmentTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

// ── Needs attention ────────────────────────────────────────────────────────────────────────────

function AttentionRow({
  count,
  countKey,
  description,
  to,
  linkLabel,
  icon: Icon,
  tone,
}: {
  count: number;
  // One i18next plural key replaces the old singular/plural prop pair. English picks between two
  // forms; Arabic picks between six, including a dual for exactly 2 — a caller-side
  // `count === 1 ? singular : plural` can never express that.
  countKey: string;
  description: string;
  to: string;
  linkLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "warning" | "info" | "muted";
}) {
  const { t } = useTranslation("overview");
  // A zero is not something that needs attention, so the row is simply absent rather than shown
  // as a cheerful "0 flagged entries".
  if (count === 0) return null;
  const box =
    tone === "warning"
      ? "border-warning/30 bg-warning/10"
      : tone === "info"
        ? "border-info/30 bg-info/10"
        : "border-border bg-muted/40";
  const iconTone =
    tone === "warning" ? "text-warning-foreground" : tone === "info" ? "text-info" : "text-muted-foreground";
  const linkTone = tone === "warning" ? "text-warning-foreground" : tone === "info" ? "text-info" : "text-primary";
  return (
    <div className={`rounded-lg border p-3 ${box}`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconTone}`} />
        <div className="flex-1 space-y-0.5">
          <p className="text-sm font-medium">{t(countKey, { count })}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button variant="link" size="sm" className={`mt-1 h-auto p-0 ${linkTone}`} asChild>
        <Link to={to}>{linkLabel}</Link>
      </Button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────────────────────

function OverviewPage() {
  const { t } = useTranslation(["overview", "common"]);
  const fmt = useFormatters();
  const relativeTime = useRelativeTime("weeks");
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });

  const stats = data?.stats;
  const attention = data?.needsAttention;
  const allClear =
    !!attention &&
    attention.flaggedEntries === 0 &&
    attention.unreadConversations === 0 &&
    attention.newLeads === 0;

  const logging = data?.mealLogging;
  const loggedPct =
    logging && logging.activeClients > 0
      ? Math.round((logging.loggedToday / logging.activeClients) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={formatEyebrow(data?.today.date, fmt)}
        title={greeting(user?.name, t)}
        description={t("overview:description")}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/journal">{t("overview:reviewJournal")}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/clients">
                {t("overview:openClients")}
                {/* A direction-carrying icon: it must point the other way in RTL, or it reads as
                    "back" on a forward action. */}
                <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
              </Link>
            </Button>
          </>
        }
      />

      {isError ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center text-sm text-destructive">
          <WifiOff className="size-8" />
          {(error as Error)?.message || t("overview:loadFailed")}
        </Card>
      ) : isLoading || !data || !stats || !logging || !attention ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stat row */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label={t("overview:stats.activeClients")}
              value={fmt.number(stats.clients.active)}
              hint={t("overview:stats.activeClientsHint", { total: fmt.number(stats.clients.total) })}
              badge={
                <TrendBadge
                  trend={stats.clients.trend}
                  labelKey="trendNew"
                  windowDays={stats.clients.trendWindowDays}
                />
              }
            />
            <StatCard
              icon={CalendarDays}
              label={t("overview:stats.activePlans")}
              value={fmt.number(stats.mealPlans.active)}
              hint={t("overview:stats.activePlansHint", {
                total: fmt.number(stats.mealPlans.total),
              })}
            />
            <StatCard
              icon={Database}
              label={t("overview:stats.foods")}
              value={fmt.number(stats.foods.total)}
              hint={foodsHint(stats.foods.bySource, t, fmt)}
            />
            <StatCard
              icon={UserPlus}
              label={t("overview:stats.newLeads")}
              value={fmt.number(stats.leads.last7Days)}
              hint={t("overview:stats.newLeadsHint", { days: stats.leads.trendWindowDays })}
              badge={
                <TrendBadge
                  trend={stats.leads.trend}
                  labelKey="trendVsPrior"
                  windowDays={stats.leads.trendWindowDays}
                />
              }
            />
          </div>

          {/* Main grid */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {/* Meal logging — practice-wide, replacing the mock's single-client calorie ring */}
            <Card className="lg:col-span-2 border-border/70 shadow-soft">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="font-display text-lg">
                    {t("overview:logging.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("overview:logging.subtitle", {
                      timeZone: data.today.timeZone.replace("_", " "),
                    })}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-primary" asChild>
                  <Link to="/journal">
                    {t("overview:logging.openJournal")}
                    <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <p className="font-display text-3xl font-semibold tracking-tight">
                    {fmt.number(logging.loggedToday)}
                    <span className="text-lg text-muted-foreground">
                      {" "}
                      {t("overview:logging.ofTotal", { total: fmt.number(logging.activeClients) })}
                    </span>
                  </p>
                  <Progress value={loggedPct} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {logging.activeClients === 0
                      ? t("overview:logging.noActiveClients")
                      : t("overview:logging.percentLogged", { percent: loggedPct })}
                  </p>
                </div>

                {logging.notLoggedCount === 0 ? (
                  <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    <p className="text-sm">
                      {logging.activeClients === 0
                        ? t("overview:logging.nothingToTrack")
                        : t("overview:logging.everyoneLogged")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("overview:logging.notLoggedHeading")}
                    </p>
                    <ul className="divide-y divide-border">
                      {logging.notLogged.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 py-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                              {initialsOf(c.name)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="flex-1 min-w-0 truncate text-sm font-medium">{c.name}</p>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {c.lastLoggedAt
                              ? t("overview:logging.lastLogged", {
                                  when: relativeTime(c.lastLoggedAt),
                                })
                              : t("overview:logging.neverLogged")}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {/* The list is capped server-side, so the count is the honest total. */}
                    {logging.notLoggedCount > logging.notLogged.length && (
                      <Button variant="link" size="sm" className="h-auto p-0 text-primary" asChild>
                        <Link to="/clients">
                          {t("overview:logging.moreClients", {
                            count: logging.notLoggedCount - logging.notLogged.length,
                            isolated: ltrIsolate(
                              `+${logging.notLoggedCount - logging.notLogged.length}`,
                            ),
                          })}
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's calendar */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="font-display text-lg">
                    {t("overview:calendar.title")}
                  </CardTitle>
                  <CardDescription>
                    {data.appointmentsToday.length === 0
                      ? t("overview:calendar.nothingBooked")
                      : t("overview:calendar.count", { count: data.appointmentsToday.length })}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-primary" asChild>
                  <Link to="/appointments">
                    {t("overview:calendar.all")}
                    <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.appointmentsToday.length === 0 ? (
                  // An empty day is a normal, expected state — not an error and not a blank list.
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
                    <CalendarDays className="size-7 text-muted-foreground/50" />
                    <p className="text-sm font-medium">{t("overview:calendar.emptyTitle")}</p>
                    <p className="max-w-[16rem] text-xs text-muted-foreground">
                      {t("overview:calendar.emptyBody")}
                    </p>
                    <Button variant="link" size="sm" className="h-auto p-0 text-primary" asChild>
                      <Link to="/appointments">{t("overview:calendar.openCalendar")}</Link>
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {data.appointmentsToday.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:border-primary/30 hover:bg-primary-soft/40"
                      >
                        <div
                          className={`flex h-10 w-10 flex-col items-center justify-center rounded-md text-xs font-medium ${
                            a.category === "gym"
                              ? "bg-accent text-accent-foreground"
                              : "bg-primary-soft text-primary"
                          }`}
                        >
                          <span className="tabular-nums leading-none">{appointmentTime(a.at)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                        </div>
                        {/* Was `{a.category}` with CSS `capitalize` — i.e. the raw API enum shown
                            to the user. Now a key lookup, so the enum VALUE stays "gym"/"diet"
                            for the API and only the display text changes. */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            a.category === "gym" ? "border-accent-foreground/20 text-accent-foreground" : ""
                          }`}
                        >
                          {t(`overview:category.${a.category}`)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom row */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {/* Activity feed */}
            <Card className="lg:col-span-2 border-border/70 shadow-soft">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="font-display text-lg">
                    {t("overview:activity.title")}
                  </CardTitle>
                  <CardDescription>{t("overview:activity.subtitle")}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-primary" asChild>
                  <Link to="/messages">
                    {t("overview:activity.openMessages")}
                    <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.activity.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <Activity className="size-7 text-muted-foreground/50" />
                    <p className="text-sm font-medium">{t("overview:activity.emptyTitle")}</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      {t("overview:activity.emptyBody")}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.activity.map((a) => {
                      const meta = ACTIVITY_META[a.type];
                      const Icon = meta?.icon ?? Activity;
                      return (
                        <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                          <Avatar className="mt-0.5 h-9 w-9">
                            <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                              {initialsOf(a.clientName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">
                              <span className="font-medium">{a.clientName}</span>{" "}
                              <span className="text-muted-foreground">
                                {meta ? t(`overview:${meta.actionKey}`) : t("overview:activity.fallback")}
                              </span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{a.meta}</p>
                          </div>
                          <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
                            <Icon className="h-3.5 w-3.5" />
                            <span>{relativeTime(a.at)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Needs attention */}
            <Card className="border-border/70 shadow-soft">
              <CardHeader>
                <CardTitle className="font-display text-lg">
                  {t("overview:attention.title")}
                </CardTitle>
                <CardDescription>{t("overview:attention.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {allClear ? (
                  // Three zeros in warning-coloured boxes would read as three problems. When
                  // nothing is outstanding the card says so, once.
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success/10 py-10 text-center">
                    <CheckCircle2 className="size-7 text-success" />
                    <p className="text-sm font-medium">{t("overview:attention.allClearTitle")}</p>
                    <p className="max-w-[15rem] text-xs text-muted-foreground">
                      {t("overview:attention.allClearBody")}
                    </p>
                  </div>
                ) : (
                  <>
                    <AttentionRow
                      count={attention.flaggedEntries}
                      countKey="attention.flagged"
                      description={t("overview:attention.flaggedDescription")}
                      to="/journal"
                      linkLabel={t("overview:attention.flaggedLink")}
                      icon={AlertCircle}
                      tone="warning"
                    />
                    <AttentionRow
                      count={attention.unreadConversations}
                      countKey="attention.unread"
                      description={t("overview:attention.unreadDescription")}
                      to="/messages"
                      linkLabel={t("overview:attention.unreadLink")}
                      icon={MessageSquare}
                      tone="info"
                    />
                    <AttentionRow
                      count={attention.newLeads}
                      countKey="attention.leads"
                      description={t("overview:attention.leadsDescription", {
                        days: stats.leads.trendWindowDays,
                      })}
                      to="/leads"
                      linkLabel={t("overview:attention.leadsLink")}
                      icon={UserPlus}
                      tone="muted"
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
