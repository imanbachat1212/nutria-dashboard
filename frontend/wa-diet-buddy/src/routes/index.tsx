import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { relativeTime } from "@/lib/mealplans-api";
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
function formatEyebrow(ymd: string | undefined): string {
  const d = ymd ? new Date(`${ymd}T00:00:00`) : new Date();
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function greeting(name: string | undefined): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  // The mock hardcoded "Good morning, Sura." — the name now comes from the logged-in user (already
  // in AuthProvider's context from /api/auth/me, so this costs no extra request) and the time of
  // day is real. First name only, which is how the greeting always read.
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Good ${part}, ${first}.` : `Good ${part}.`;
}

// ── Stat row ───────────────────────────────────────────────────────────────────────────────────

function TrendBadge({ trend, noun, windowDays }: { trend: OverviewTrend | null; noun: string; windowDays: number }) {
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
      {sign}
      {trend.delta} {noun} in {windowDays}d
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
function foodsHint(bySource: Overview["stats"]["foods"]["bySource"]): string {
  const parts = [
    bySource.usda ? `${bySource.usda.toLocaleString()} USDA` : null,
    bySource.lebanese ? `${bySource.lebanese} Lebanese` : null,
    bySource.custom ? `${bySource.custom} custom` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" + ") : "no foods yet";
}

// ── Activity feed ──────────────────────────────────────────────────────────────────────────────

// type → icon + wording, mapped here rather than sent from the backend: the payload carries a
// stable `type` string and this file owns how it reads.
const ACTIVITY_META: Record<ActivityType, { icon: React.ComponentType<{ className?: string }>; action: string }> = {
  "journal-meal": { icon: Utensils, action: "logged a meal" },
  "journal-exercise": { icon: Dumbbell, action: "logged activity" },
  "lead-new": { icon: UserPlus, action: "came in as a new lead" },
  "message-inbound": { icon: MessageSquare, action: "sent a message" },
  "appointment-booked": { icon: CalendarDays, action: "booked an appointment" },
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
  singular,
  plural,
  description,
  to,
  linkLabel,
  icon: Icon,
  tone,
}: {
  count: number;
  singular: string;
  plural: string;
  description: string;
  to: string;
  linkLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "warning" | "info" | "muted";
}) {
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
          <p className="text-sm font-medium">
            {count} {count === 1 ? singular : plural}
          </p>
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
        eyebrow={formatEyebrow(data?.today.date)}
        title={greeting(user?.name)}
        description="Here's what's happening across your practice today — clients, plans, and the WhatsApp queue at a glance."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/journal">Review journal</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/clients">
                Open clients
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {isError ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center text-sm text-destructive">
          <WifiOff className="size-8" />
          {(error as Error)?.message || "Couldn't load your practice overview. Try again shortly."}
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
              label="Active clients"
              value={stats.clients.active.toLocaleString()}
              hint={`of ${stats.clients.total.toLocaleString()} total`}
              badge={
                <TrendBadge trend={stats.clients.trend} noun="new" windowDays={stats.clients.trendWindowDays} />
              }
            />
            <StatCard
              icon={CalendarDays}
              label="Active meal plans"
              value={stats.mealPlans.active.toLocaleString()}
              hint={`of ${stats.mealPlans.total.toLocaleString()} total`}
            />
            <StatCard
              icon={Database}
              label="Foods in database"
              value={stats.foods.total.toLocaleString()}
              hint={foodsHint(stats.foods.bySource)}
            />
            <StatCard
              icon={UserPlus}
              label="New leads"
              value={stats.leads.last7Days.toLocaleString()}
              hint={`in last ${stats.leads.trendWindowDays} days`}
              badge={
                <TrendBadge trend={stats.leads.trend} noun="vs prior" windowDays={stats.leads.trendWindowDays} />
              }
            />
          </div>

          {/* Main grid */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {/* Meal logging — practice-wide, replacing the mock's single-client calorie ring */}
            <Card className="lg:col-span-2 border-border/70 shadow-soft">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="font-display text-lg">Logged a meal today</CardTitle>
                  <CardDescription>
                    Across your active roster · {data.today.timeZone.replace("_", " ")} day
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-primary" asChild>
                  <Link to="/journal">
                    Open journal
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <p className="font-display text-3xl font-semibold tracking-tight">
                    {logging.loggedToday}
                    <span className="text-lg text-muted-foreground"> of {logging.activeClients}</span>
                  </p>
                  <Progress value={loggedPct} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {logging.activeClients === 0
                      ? "No active clients on the roster yet."
                      : `${loggedPct}% of active clients have logged a meal today.`}
                  </p>
                </div>

                {logging.notLoggedCount === 0 ? (
                  <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    <p className="text-sm">
                      {logging.activeClients === 0
                        ? "Nothing to track yet — add your first client to get started."
                        : "Everyone on the roster has logged today."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Not logged yet · longest quiet first
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
                            {c.lastLoggedAt ? `last logged ${relativeTime(c.lastLoggedAt)}` : "never logged"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {/* The list is capped server-side, so the count is the honest total. */}
                    {logging.notLoggedCount > logging.notLogged.length && (
                      <Button variant="link" size="sm" className="h-auto p-0 text-primary" asChild>
                        <Link to="/clients">
                          +{logging.notLoggedCount - logging.notLogged.length} more — open clients
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
                  <CardTitle className="font-display text-lg">Today's calendar</CardTitle>
                  <CardDescription>
                    {data.appointmentsToday.length === 0
                      ? "Nothing booked"
                      : `${data.appointmentsToday.length} appointment${data.appointmentsToday.length === 1 ? "" : "s"}`}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-primary" asChild>
                  <Link to="/appointments">
                    All
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.appointmentsToday.length === 0 ? (
                  // An empty day is a normal, expected state — not an error and not a blank list.
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
                    <CalendarDays className="size-7 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No appointments today</p>
                    <p className="max-w-[16rem] text-xs text-muted-foreground">
                      Your calendar is clear. Book a consultation from the Appointments page.
                    </p>
                    <Button variant="link" size="sm" className="h-auto p-0 text-primary" asChild>
                      <Link to="/appointments">Open calendar</Link>
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
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            a.category === "gym" ? "border-accent-foreground/20 text-accent-foreground" : ""
                          }`}
                        >
                          {a.category}
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
                  <CardTitle className="font-display text-lg">Recent activity</CardTitle>
                  <CardDescription>
                    WhatsApp logs, replies and bookings from across your clients
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-primary" asChild>
                  <Link to="/messages">
                    Open messages
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.activity.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <Activity className="size-7 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No activity yet</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      Meal logs, inbound WhatsApp messages, new leads and bookings will appear here as
                      they happen.
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
                              <span className="text-muted-foreground">{meta?.action ?? "activity"}</span>
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
                <CardTitle className="font-display text-lg">Needs attention</CardTitle>
                <CardDescription>Quality control flags from automated logging</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {allClear ? (
                  // Three zeros in warning-coloured boxes would read as three problems. When
                  // nothing is outstanding the card says so, once.
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success/10 py-10 text-center">
                    <CheckCircle2 className="size-7 text-success" />
                    <p className="text-sm font-medium">All clear</p>
                    <p className="max-w-[15rem] text-xs text-muted-foreground">
                      Nothing needs attention right now — no flagged entries, no unanswered replies,
                      no new leads waiting.
                    </p>
                  </div>
                ) : (
                  <>
                    <AttentionRow
                      count={attention.flaggedEntries}
                      singular="flagged entry"
                      plural="flagged entries"
                      description="AI flagged something unusual — needs a spot check."
                      to="/journal"
                      linkLabel="Review entries"
                      icon={AlertCircle}
                      tone="warning"
                    />
                    <AttentionRow
                      count={attention.unreadConversations}
                      singular="conversation awaiting a reply"
                      plural="conversations awaiting a reply"
                      description="Clients whose last message hasn't been answered."
                      to="/messages"
                      linkLabel="Open inbox"
                      icon={MessageSquare}
                      tone="info"
                    />
                    <AttentionRow
                      count={attention.newLeads}
                      singular="new lead"
                      plural="new leads"
                      description={`From inquiries in the last ${stats.leads.trendWindowDays} days — ready to qualify.`}
                      to="/leads"
                      linkLabel="View pipeline"
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
