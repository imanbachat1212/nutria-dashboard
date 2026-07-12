// Not a fixed enum — Settings → Plan lets the practice define new package tiers, so this is
// just the id of whatever's in PACKAGES at a given time, not a closed set of literals.
export type PackageTier = string;
export type InvoiceStatus = "paid" | "pending" | "overdue" | "refunded";
export type PaymentMethod = "card" | "bank" | "cash" | "wallet";

export interface PackageDef {
  id: PackageTier;
  name: string;
  priceMonthly: number;
  includes: string[];
  activeClients: number;
  color: string; // tailwind class fragment
}

export interface InvoiceRow {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  package: PackageTier;
  amount: number;
  issuedAt: string; // ISO
  dueAt: string;
  status: InvoiceStatus;
  method?: PaymentMethod;
}

export interface RevenuePoint {
  month: string;
  collected: number;
  pending: number;
}

export interface UpcomingRenewal {
  id: string;
  clientName: string;
  package: PackageTier;
  amount: number;
  renewsAt: string;
}

export const PACKAGES: PackageDef[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 49,
    includes: ["1 meal plan / month", "Chat support", "Weekly check-in"],
    activeClients: 12,
    color: "bg-slate-500",
  },
  {
    id: "standard",
    name: "Standard",
    priceMonthly: 89,
    includes: ["2 meal plans / month", "Journal review", "Bi-weekly call"],
    activeClients: 18,
    color: "bg-primary",
  },
  {
    id: "premium",
    name: "Premium",
    priceMonthly: 149,
    includes: ["Weekly meal plans", "Gym programming", "Weekly 1:1 call"],
    activeClients: 14,
    color: "bg-amber-500",
  },
  {
    id: "elite",
    name: "Elite",
    priceMonthly: 249,
    includes: ["Daily journal review", "Gym + diet", "On-demand chat", "Lab review"],
    activeClients: 6,
    color: "bg-rose-500",
  },
];

export const REVENUE_TREND: RevenuePoint[] = [
  { month: "Jan", collected: 9800, pending: 1100 },
  { month: "Feb", collected: 10400, pending: 900 },
  { month: "Mar", collected: 11250, pending: 1450 },
  { month: "Apr", collected: 12100, pending: 1200 },
  { month: "May", collected: 13680, pending: 1850 },
  { month: "Jun", collected: 14520, pending: 1640 },
  { month: "Jul", collected: 15980, pending: 1320 },
  { month: "Aug", collected: 16240, pending: 2100 },
  { month: "Sep", collected: 17850, pending: 1480 },
  { month: "Oct", collected: 18620, pending: 1720 },
  { month: "Nov", collected: 19340, pending: 1980 },
  { month: "Dec", collected: 20480, pending: 1560 },
];

export const INVOICES: InvoiceRow[] = [
  {
    id: "i1",
    number: "INV-2026-0148",
    clientId: "c1",
    clientName: "Sara El Amrani",
    package: "elite",
    amount: 249,
    issuedAt: "2026-06-18",
    dueAt: "2026-06-25",
    status: "paid",
    method: "card",
  },
  {
    id: "i2",
    number: "INV-2026-0147",
    clientId: "c2",
    clientName: "Youssef Bennani",
    package: "premium",
    amount: 149,
    issuedAt: "2026-06-17",
    dueAt: "2026-06-24",
    status: "paid",
    method: "bank",
  },
  {
    id: "i3",
    number: "INV-2026-0146",
    clientId: "c3",
    clientName: "Imane Tazi",
    package: "standard",
    amount: 89,
    issuedAt: "2026-06-15",
    dueAt: "2026-06-22",
    status: "pending",
    method: "card",
  },
  {
    id: "i4",
    number: "INV-2026-0145",
    clientId: "c4",
    clientName: "Karim Idrissi",
    package: "premium",
    amount: 149,
    issuedAt: "2026-06-12",
    dueAt: "2026-06-19",
    status: "overdue",
  },
  {
    id: "i5",
    number: "INV-2026-0144",
    clientId: "c5",
    clientName: "Nadia Cherkaoui",
    package: "standard",
    amount: 89,
    issuedAt: "2026-06-10",
    dueAt: "2026-06-17",
    status: "paid",
    method: "wallet",
  },
  {
    id: "i6",
    number: "INV-2026-0143",
    clientId: "c6",
    clientName: "Omar Fassi",
    package: "starter",
    amount: 49,
    issuedAt: "2026-06-08",
    dueAt: "2026-06-15",
    status: "paid",
    method: "cash",
  },
  {
    id: "i7",
    number: "INV-2026-0142",
    clientId: "c7",
    clientName: "Layla Berrada",
    package: "starter",
    amount: 49,
    issuedAt: "2026-06-06",
    dueAt: "2026-06-13",
    status: "refunded",
    method: "card",
  },
  {
    id: "i8",
    number: "INV-2026-0141",
    clientId: "c8",
    clientName: "Hicham Naciri",
    package: "elite",
    amount: 249,
    issuedAt: "2026-06-05",
    dueAt: "2026-06-12",
    status: "paid",
    method: "bank",
  },
  {
    id: "i9",
    number: "INV-2026-0140",
    clientId: "c9",
    clientName: "Salma Ouazzani",
    package: "premium",
    amount: 149,
    issuedAt: "2026-06-03",
    dueAt: "2026-06-10",
    status: "overdue",
  },
  {
    id: "i10",
    number: "INV-2026-0139",
    clientId: "c10",
    clientName: "Mehdi Lahlou",
    package: "standard",
    amount: 89,
    issuedAt: "2026-06-02",
    dueAt: "2026-06-09",
    status: "paid",
    method: "card",
  },
];

export const UPCOMING_RENEWALS: UpcomingRenewal[] = [
  { id: "r1", clientName: "Sara El Amrani", package: "elite", amount: 249, renewsAt: "2026-06-25" },
  {
    id: "r2",
    clientName: "Youssef Bennani",
    package: "premium",
    amount: 149,
    renewsAt: "2026-06-26",
  },
  { id: "r3", clientName: "Imane Tazi", package: "standard", amount: 89, renewsAt: "2026-06-28" },
  {
    id: "r4",
    clientName: "Nadia Cherkaoui",
    package: "standard",
    amount: 89,
    renewsAt: "2026-06-30",
  },
  { id: "r5", clientName: "Mehdi Lahlou", package: "standard", amount: 89, renewsAt: "2026-07-02" },
];

export const STATUS_STYLES: Record<InvoiceStatus, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  overdue: { label: "Overdue", cls: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
  refunded: { label: "Refunded", cls: "bg-slate-500/10 text-slate-700 border-slate-500/20" },
};

export function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
