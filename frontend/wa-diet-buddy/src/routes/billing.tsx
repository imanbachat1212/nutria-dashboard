import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  Plus,
  Download,
  Search,
  MoreHorizontal,
  CreditCard,
  Landmark,
  Wallet as WalletIcon,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Send,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
import {
  PACKAGES,
  REVENUE_TREND,
  INVOICES,
  UPCOMING_RENEWALS,
  STATUS_STYLES,
  fmtMoney,
  fmtDate,
  type InvoiceStatus,
  type PaymentMethod,
} from "@/lib/billing-mock";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { NewInvoiceDialog } from "@/components/new-invoice-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Nutria" },
      {
        name: "description",
        content: "Practice revenue, package tiers, and per-client payment history.",
      },
    ],
  }),
  component: BillingPage,
});

type StatusFilter = "all" | InvoiceStatus;

const METHOD_ICON: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  card: CreditCard,
  bank: Landmark,
  cash: Banknote,
  wallet: WalletIcon,
};

function BillingPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [pkg, setPkg] = useState<string>("all");
  const [invoices, setInvoices] = useState(INVOICES);
  const [newOpen, setNewOpen] = useState(false);

  const stats = useMemo(() => {
    const mtd = REVENUE_TREND[REVENUE_TREND.length - 1];
    const prev = REVENUE_TREND[REVENUE_TREND.length - 2];
    const mtdDelta = ((mtd.collected - prev.collected) / prev.collected) * 100;
    const outstanding = invoices
      .filter((i) => i.status === "pending" || i.status === "overdue")
      .reduce((s, i) => s + i.amount, 0);
    const overdueCount = invoices.filter((i) => i.status === "overdue").length;
    const arpu = Math.round(
      PACKAGES.reduce((s, p) => s + p.priceMonthly * p.activeClients, 0) /
        PACKAGES.reduce((s, p) => s + p.activeClients, 0),
    );
    return {
      mtd: mtd.collected,
      mtdDelta,
      outstanding,
      overdueCount,
      arpu,
      activeSubs: PACKAGES.reduce((s, p) => s + p.activeClients, 0),
    };
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (pkg !== "all" && i.package !== pkg) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!i.clientName.toLowerCase().includes(q) && !i.number.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [invoices, query, status, pkg]);

  const nextNumber = useMemo(() => {
    const max = invoices.reduce((m, i) => {
      const n = Number(i.number.split("-").pop());
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return max + 1;
  }, [invoices]);

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Practice revenue, package tiers, and per-client payment history."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New invoice
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="MTD revenue"
          value={fmtMoney(stats.mtd)}
          delta={`${stats.mtdDelta > 0 ? "+" : ""}${stats.mtdDelta.toFixed(1)}% vs last month`}
          positive={stats.mtdDelta >= 0}
        />
        <KpiCard
          icon={Clock}
          label="Outstanding"
          value={fmtMoney(stats.outstanding)}
          delta={`${stats.overdueCount} overdue`}
          positive={stats.overdueCount === 0}
        />
        <KpiCard
          icon={TrendingUp}
          label="ARPU / month"
          value={fmtMoney(stats.arpu)}
          delta={`${stats.activeSubs} active subscriptions`}
          positive
        />
        <KpiCard
          icon={AlertCircle}
          label="Refunds this month"
          value="1"
          delta="$49 refunded"
          positive={false}
          muted
        />
      </div>

      {/* Revenue chart + renewals */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold">Revenue — last 12 months</h2>
              <p className="text-xs text-muted-foreground">Collected vs pending, monthly</p>
            </div>
            <Tabs defaultValue="12m">
              <TabsList>
                <TabsTrigger value="3m">3m</TabsTrigger>
                <TabsTrigger value="6m">6m</TabsTrigger>
                <TabsTrigger value="12m">12m</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REVENUE_TREND} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <Tooltip
                  formatter={(v: number) => fmtMoney(v)}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="collected"
                  name="Collected"
                  stackId="a"
                  fill="hsl(var(--primary))"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="pending"
                  name="Pending"
                  stackId="a"
                  fill="hsl(38 90% 60%)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Upcoming renewals</h2>
              <p className="text-xs text-muted-foreground">Next 14 days</p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <CalendarClock className="h-3 w-3" />
              {UPCOMING_RENEWALS.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {UPCOMING_RENEWALS.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 hover:bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">
                      {r.clientName
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-medium leading-tight">{r.clientName}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {r.package} · {fmtDate(r.renewsAt)}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">{fmtMoney(r.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Packages */}
      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold">Package tiers</h2>
            <p className="text-xs text-muted-foreground">Active subscribers per tier</p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs">
            Manage packages
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PACKAGES.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", p.color)} />
                  <h3 className="text-sm font-semibold">{p.name}</h3>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {p.activeClients} active
                </Badge>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                {fmtMoney(p.priceMonthly)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/ mo</span>
              </p>
              <ul className="mt-3 space-y-1.5">
                {p.includes.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                MRR ·{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {fmtMoney(p.priceMonthly * p.activeClients)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Invoices */}
      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Invoices</h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {invoices.length}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search client or invoice…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 w-56 pl-7 text-xs"
              />
            </div>
            <Select value={pkg} onValueChange={setPkg}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All packages</SelectItem>
                {PACKAGES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div className="col-span-3">Client</div>
            <div className="col-span-2">Invoice</div>
            <div className="col-span-2">Package</div>
            <div className="col-span-2">Issued / Due</div>
            <div className="col-span-1 text-right">Amount</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No invoices match your filters.
            </div>
          )}
          {filtered.map((inv) => {
            const Method = inv.method ? METHOD_ICON[inv.method] : null;
            const s = STATUS_STYLES[inv.status];
            return (
              <div
                key={inv.id}
                className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0 hover:bg-muted/30"
              >
                <div className="col-span-3 flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {inv.clientName
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium leading-tight">{inv.clientName}</span>
                </div>
                <div className="col-span-2 font-mono text-xs text-muted-foreground">
                  {inv.number}
                </div>
                <div className="col-span-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {inv.package}
                  </Badge>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {fmtDate(inv.issuedAt)} → {fmtDate(inv.dueAt)}
                </div>
                <div className="col-span-1 text-right text-sm font-semibold tabular-nums">
                  {fmtMoney(inv.amount)}
                </div>
                <div className="col-span-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      s.cls,
                    )}
                  >
                    {Method && inv.status === "paid" && <Method className="h-3 w-3" />}
                    {s.label}
                  </span>
                </div>
                <div className="col-span-1 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => generateInvoicePdf(inv)}>
                        <Download className="mr-2 h-3.5 w-3.5" />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Send className="mr-2 h-3.5 w-3.5" />
                        Send reminder
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                        Mark as paid
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <NewInvoiceDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        nextNumber={nextNumber}
        onCreate={(inv) => {
          setInvoices((prev) => [inv, ...prev]);
          toast.success(`Invoice ${inv.number} created`, {
            description: `${inv.clientName} · ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(inv.amount)}`,
            action: {
              label: "Download PDF",
              onClick: () => generateInvoicePdf(inv),
            },
          });
        }}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  positive,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  muted?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="rounded-md bg-muted p-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <span
          className={cn(
            "text-[11px] font-medium",
            muted ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {delta}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
