import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  CalendarDays,
  Database,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Clock,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Utensils,
  Flame,
  Activity,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

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

type Trend = "up" | "down" | "flat";

const stats: {
  label: string;
  value: string;
  hint: string;
  trend: Trend;
  delta: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { label: "Active clients", value: "84", hint: "of 112 total", trend: "up", delta: "+6 this month", icon: Users },
  { label: "Active meal plans", value: "67", hint: "across diet + diet/gym", trend: "up", delta: "+9 this week", icon: CalendarDays },
  { label: "Foods in database", value: "312,408", hint: "USDA + 184 Lebanese", trend: "flat", delta: "21 added this week", icon: Database },
  { label: "New leads", value: "23", hint: "in last 7 days", trend: "up", delta: "+38% vs prior", icon: UserPlus },
];

const todaysClient = {
  name: "Rana Khoury",
  plan: "Cutting · 1,650 kcal",
  consumed: 1180,
  target: 1650,
  macros: [
    { label: "Protein", current: 92, target: 130, color: "bg-chart-1" },
    { label: "Carbs", current: 118, target: 170, color: "bg-chart-3" },
    { label: "Fat", current: 41, target: 55, color: "bg-chart-4" },
  ],
  meals: [
    { time: "08:15", name: "Labneh + za'atar manoushe ½", kcal: 380, status: "logged" },
    { time: "12:40", name: "Grilled chicken tabbouleh bowl", kcal: 520, status: "logged" },
    { time: "16:00", name: "Apple + 20g almonds", kcal: 280, status: "logged" },
    { time: "20:30", name: "Salmon, freekeh, roasted veg", kcal: 470, status: "planned" },
  ],
};

const activity = [
  { who: "Maya Saade", action: "logged dinner photo", meta: "kibbeh + salad · 612 kcal", time: "4m ago", icon: Utensils },
  { who: "Unknown · +961 71 …", action: "new WhatsApp inquiry", meta: "captured as lead", time: "12m ago", icon: UserPlus },
  { who: "Karim Aoun", action: "completed week 3 check-in", meta: "-1.2 kg, on target", time: "1h ago", icon: TrendingDown },
  { who: "Nour El-Hage", action: "replied in chat", meta: "asked about gym session swap", time: "2h ago", icon: MessageSquare },
  { who: "Tarek Mansour", action: "booked gym slot", meta: "Thu 18:00 · 3/4 capacity", time: "3h ago", icon: Activity },
];

const appointments = [
  { time: "10:00", client: "Sara Younes", type: "Initial consultation", kind: "diet" as const },
  { time: "11:30", client: "Walid Rahme", type: "Follow-up · weigh-in", kind: "diet" as const },
  { time: "14:00", client: "Group · 4 people", type: "Gym session", kind: "gym" as const },
  { time: "16:30", client: "Layan Issa", type: "Plan review", kind: "diet" as const },
];

function TrendIcon({ trend, className }: { trend: Trend; className?: string }) {
  if (trend === "up") return <TrendingUp className={className} />;
  if (trend === "down") return <TrendingDown className={className} />;
  return <Clock className={className} />;
}

function OverviewPage() {
  const consumedPct = Math.round((todaysClient.consumed / todaysClient.target) * 100);
  const remaining = todaysClient.target - todaysClient.consumed;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Tuesday, June 17"
        title="Good morning, Sura."
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

      {/* Stat row */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="overflow-hidden border-border/70 shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <Badge
                  variant="secondary"
                  className="gap-1 bg-success/10 text-success border-0 font-medium"
                >
                  <TrendIcon trend={s.trend} className="h-3 w-3" />
                  {s.delta}
                </Badge>
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="font-display text-3xl font-semibold tracking-tight">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Today's snapshot — spans 2 cols */}
        <Card className="lg:col-span-2 border-border/70 shadow-soft">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="font-display text-lg">Today's snapshot</CardTitle>
              <CardDescription>
                {todaysClient.name} · {todaysClient.plan}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link to="/clients">
                Open client
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Calorie ring summary */}
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex items-center gap-4 rounded-xl bg-primary-soft/60 p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-primary shadow-soft">
                  <Flame className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Calories</p>
                  <p className="font-display text-2xl font-semibold leading-tight">
                    {todaysClient.consumed.toLocaleString()}
                    <span className="text-base text-muted-foreground"> / {todaysClient.target.toLocaleString()}</span>
                  </p>
                  <p className="text-xs text-success font-medium">{remaining} kcal remaining</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Daily progress</span>
                  <span className="font-medium">{consumedPct}%</span>
                </div>
                <Progress value={consumedPct} className="h-2" />
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {todaysClient.macros.map((m) => {
                    const pct = Math.round((m.current / m.target) * 100);
                    return (
                      <div key={m.label} className="space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-medium">{m.label}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {m.current}/{m.target}g
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className={`h-full ${m.color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <Separator />

            {/* Meal timeline */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Today's meals
              </p>
              <ul className="divide-y divide-border">
                {todaysClient.meals.map((meal) => (
                  <li key={meal.time + meal.name} className="flex items-center gap-3 py-2.5">
                    <span className="w-12 text-xs font-medium text-muted-foreground tabular-nums">
                      {meal.time}
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                      {meal.status === "logged" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{meal.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{meal.status}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{meal.kcal} kcal</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Appointments */}
        <Card className="border-border/70 shadow-soft">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="font-display text-lg">Today's calendar</CardTitle>
              <CardDescription>4 appointments · 1 gym slot</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link to="/appointments">
                All
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {appointments.map((a) => (
                <li
                  key={a.time + a.client}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:border-primary/30 hover:bg-primary-soft/40"
                >
                  <div
                    className={`flex h-10 w-10 flex-col items-center justify-center rounded-md text-xs font-medium ${
                      a.kind === "gym"
                        ? "bg-accent text-accent-foreground"
                        : "bg-primary-soft text-primary"
                    }`}
                  >
                    <span className="tabular-nums leading-none">{a.time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.client}</p>
                    <p className="text-xs text-muted-foreground">{a.type}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      a.kind === "gym" ? "border-accent-foreground/20 text-accent-foreground" : ""
                    }`}
                  >
                    {a.kind}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Activity feed — spans 2 */}
        <Card className="lg:col-span-2 border-border/70 shadow-soft">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="font-display text-lg">Recent activity</CardTitle>
              <CardDescription>WhatsApp logs, replies and check-ins from across your clients</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link to="/messages">
                Open messages
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar className="h-9 w-9 mt-0.5">
                    <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                      {a.who
                        .split(" ")
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{a.who}</span>{" "}
                      <span className="text-muted-foreground">{a.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{a.meta}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                    <a.icon className="h-3.5 w-3.5" />
                    <span>{a.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Attention column */}
        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-lg">Needs attention</CardTitle>
            <CardDescription>Quality control flags from automated logging</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-warning-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium">3 flagged entries</p>
                  <p className="text-xs text-muted-foreground">
                    Unusual calorie counts in last 24h — needs spot check.
                  </p>
                </div>
              </div>
              <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-warning-foreground" asChild>
                <Link to="/journal">Review entries</Link>
              </Button>
            </div>

            <div className="rounded-lg border border-info/30 bg-info/10 p-3">
              <div className="flex items-start gap-2.5">
                <MessageSquare className="h-4 w-4 text-info mt-0.5 shrink-0" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium">5 unread replies</p>
                  <p className="text-xs text-muted-foreground">
                    Clients waiting on a response in WhatsApp.
                  </p>
                </div>
              </div>
              <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-info" asChild>
                <Link to="/messages">Open inbox</Link>
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-start gap-2.5">
                <UserPlus className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium">7 new leads</p>
                  <p className="text-xs text-muted-foreground">
                    From WhatsApp inquiries — ready to qualify.
                  </p>
                </div>
              </div>
              <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-primary" asChild>
                <Link to="/leads">View pipeline</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
