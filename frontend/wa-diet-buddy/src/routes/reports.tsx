import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Activity,
  Flame,
  Scale,
  Dumbbell,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  REPORT_SUMMARY,
  ADHERENCE_TREND,
  MACRO_BREAKDOWN,
  TOP_PROGRESS,
  SERVICE_MIX,
  FLAG_BUCKETS,
  fmtPct,
  fmtMoney,
  type RangeKey,
} from "@/lib/reports-mock";
import { generateReportPdf } from "@/lib/reports-pdf";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Nutria" },
      {
        name: "description",
        content:
          "Weekly and monthly summaries — calories, macros, adherence, time-to-goal.",
      },
    ],
  }),
  component: ReportsPage,
});

const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const summary = REPORT_SUMMARY[range];
  const trend = ADHERENCE_TREND[range];

  const kpis = useMemo(
    () => [
      {
        label: "Active clients",
        value: summary.activeClients.toString(),
        delta: summary.activeClientsDelta,
        icon: Users,
        positive: true,
      },
      {
        label: "Avg adherence",
        value: `${summary.adherence}%`,
        delta: summary.adherenceDelta,
        icon: Activity,
        positive: true,
      },
      {
        label: "Avg calories / day",
        value: summary.avgCalories.toLocaleString(),
        delta: summary.avgCaloriesDelta,
        icon: Flame,
        positive: summary.avgCaloriesDelta <= 0,
      },
      {
        label: "Avg weight change",
        value: `${summary.weightChange > 0 ? "+" : ""}${summary.weightChange} kg`,
        delta: summary.weightChangeDelta,
        icon: Scale,
        positive: summary.weightChange < 0,
      },
      {
        label: "Sessions completed",
        value: summary.sessionsCompleted.toString(),
        delta: summary.sessionsDelta,
        icon: Dumbbell,
        positive: true,
      },
      {
        label: "Revenue",
        value: fmtMoney(summary.revenue),
        delta: summary.revenueDelta,
        icon: DollarSign,
        positive: true,
      },
    ],
    [summary],
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Weekly and monthly summaries — calories, macros, adherence, time-to-goal."
        actions={
          <>
            <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <TabsList>
                <TabsTrigger value="7d">7d</TabsTrigger>
                <TabsTrigger value="30d">30d</TabsTrigger>
                <TabsTrigger value="90d">90d</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Custom
            </Button>
            <Button size="sm" onClick={() => generateReportPdf(range)}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          const up = k.delta >= 0;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between">
                <div className="rounded-md bg-muted p-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    k.positive ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {up ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {fmtPct(k.delta)}
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                {k.value}
              </p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Adherence trend + service mix */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold">Adherence trend</h2>
              <p className="text-xs text-muted-foreground">
                Diet vs gym — {RANGE_LABEL[range]}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <LegendDot color="hsl(var(--primary))" label="Diet" />
              <LegendDot color="hsl(168 70% 45%)" label="Gym" />
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="diet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gym" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(168 70% 45%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(168 70% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="diet" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#diet)" />
                <Area type="monotone" dataKey="gym" stroke="hsl(168 70% 45%)" strokeWidth={2} fill="url(#gym)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Service mix</h2>
          <p className="text-xs text-muted-foreground">
            Active clients by program
          </p>
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={SERVICE_MIX}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  stroke="hsl(var(--background))"
                >
                  {SERVICE_MIX.map((s) => (
                    <Cell key={s.label} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {SERVICE_MIX.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <LegendDot color={s.color} label={s.label} />
                <span className="font-medium tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Macros + flags */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Avg macros / day</h2>
          <p className="text-xs text-muted-foreground">Across active clients</p>
          <div className="mt-4 space-y-4">
            {MACRO_BREAKDOWN.map((m) => (
              <div key={m.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground">
                    {m.grams} g · {m.pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      m.name === "Protein" && "bg-primary",
                      m.name === "Carbs" && "bg-amber-500",
                      m.name === "Fat" && "bg-rose-500",
                    )}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Target split is 30 / 45 / 25 — clients are on profile.
          </div>
        </Card>

        <Card className="lg:col-span-2 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Flagged events</h2>
              <p className="text-xs text-muted-foreground">
                What journal review caught this period
              </p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {FLAG_BUCKETS.reduce((a, b) => a + b.count, 0)} total
            </Badge>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FLAG_BUCKETS} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top client progress */}
      <Card className="mt-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Client progress</h2>
            <p className="text-xs text-muted-foreground">
              Ranked by adherence — {RANGE_LABEL[range]}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs">
            View all
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div className="col-span-5">Client</div>
            <div className="col-span-2">Service</div>
            <div className="col-span-2">Adherence</div>
            <div className="col-span-2">Weight Δ</div>
            <div className="col-span-1 text-right">Streak</div>
          </div>
          {TOP_PROGRESS.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0 hover:bg-muted/30"
            >
              <div className="col-span-5 flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {c.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium leading-tight">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.status === "on-track" && "On track"}
                    {c.status === "at-risk" && "At risk"}
                    {c.status === "off-track" && "Off track"}
                  </p>
                </div>
              </div>
              <div className="col-span-2">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {c.service}
                </Badge>
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        c.adherence >= 80 && "bg-emerald-500",
                        c.adherence >= 60 && c.adherence < 80 && "bg-amber-500",
                        c.adherence < 60 && "bg-rose-500",
                      )}
                      style={{ width: `${c.adherence}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums">
                    {c.adherence}%
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "col-span-2 text-sm font-medium tabular-nums",
                  c.weightDelta < 0 && "text-emerald-600",
                  c.weightDelta > 0 && "text-rose-600",
                  c.weightDelta === 0 && "text-muted-foreground",
                )}
              >
                {c.weightDelta > 0 ? "+" : ""}
                {c.weightDelta} kg
              </div>
              <div className="col-span-1 text-right text-sm tabular-nums text-muted-foreground">
                {c.streak}d
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
