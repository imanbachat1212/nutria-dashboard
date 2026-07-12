export type RangeKey = "7d" | "30d" | "90d";

export interface KpiPoint {
  label: string;
  value: number;
}

export interface ReportSummary {
  range: RangeKey;
  activeClients: number;
  activeClientsDelta: number; // pct vs prev period
  adherence: number; // 0-100
  adherenceDelta: number;
  avgCalories: number;
  avgCaloriesDelta: number;
  weightChange: number; // kg avg
  weightChangeDelta: number;
  sessionsCompleted: number;
  sessionsDelta: number;
  revenue: number;
  revenueDelta: number;
}

export interface AdherencePoint {
  date: string; // short label
  diet: number;
  gym: number;
}

export interface MacroBreakdown {
  name: "Protein" | "Carbs" | "Fat";
  grams: number;
  pct: number;
}

export interface ClientProgressRow {
  id: string;
  name: string;
  service: "diet" | "gym" | "diet+gym" | "classes";
  adherence: number;
  weightDelta: number; // kg, negative = loss
  streak: number; // days
  status: "on-track" | "at-risk" | "off-track";
}

export interface ServiceMix {
  label: string;
  value: number;
  color: string;
}

export interface FlagBucket {
  label: string;
  count: number;
}

export const REPORT_SUMMARY: Record<RangeKey, ReportSummary> = {
  "7d": {
    range: "7d",
    activeClients: 48,
    activeClientsDelta: 4.2,
    adherence: 82,
    adherenceDelta: 3.1,
    avgCalories: 1965,
    avgCaloriesDelta: -1.4,
    weightChange: -0.6,
    weightChangeDelta: -12.5,
    sessionsCompleted: 36,
    sessionsDelta: 8.0,
    revenue: 4280,
    revenueDelta: 6.4,
  },
  "30d": {
    range: "30d",
    activeClients: 52,
    activeClientsDelta: 8.9,
    adherence: 78,
    adherenceDelta: 2.4,
    avgCalories: 1990,
    avgCaloriesDelta: -0.9,
    weightChange: -2.1,
    weightChangeDelta: -18.0,
    sessionsCompleted: 142,
    sessionsDelta: 11.2,
    revenue: 18650,
    revenueDelta: 9.1,
  },
  "90d": {
    range: "90d",
    activeClients: 58,
    activeClientsDelta: 15.6,
    adherence: 75,
    adherenceDelta: 5.7,
    avgCalories: 2020,
    avgCaloriesDelta: 0.6,
    weightChange: -5.4,
    weightChangeDelta: -22.0,
    sessionsCompleted: 412,
    sessionsDelta: 14.8,
    revenue: 56200,
    revenueDelta: 12.3,
  },
};

export const ADHERENCE_TREND: Record<RangeKey, AdherencePoint[]> = {
  "7d": [
    { date: "Mon", diet: 78, gym: 70 },
    { date: "Tue", diet: 82, gym: 74 },
    { date: "Wed", diet: 80, gym: 80 },
    { date: "Thu", diet: 85, gym: 76 },
    { date: "Fri", diet: 81, gym: 82 },
    { date: "Sat", diet: 76, gym: 68 },
    { date: "Sun", diet: 84, gym: 72 },
  ],
  "30d": Array.from({ length: 30 }, (_, i) => ({
    date: `D${i + 1}`,
    diet: 70 + Math.round(Math.sin(i / 3) * 8 + Math.random() * 6),
    gym: 65 + Math.round(Math.cos(i / 4) * 9 + Math.random() * 6),
  })),
  "90d": Array.from({ length: 12 }, (_, i) => ({
    date: `W${i + 1}`,
    diet: 68 + Math.round(Math.sin(i / 2) * 7 + Math.random() * 5),
    gym: 64 + Math.round(Math.cos(i / 2) * 8 + Math.random() * 5),
  })),
};

export const MACRO_BREAKDOWN: MacroBreakdown[] = [
  { name: "Protein", grams: 138, pct: 30 },
  { name: "Carbs", grams: 220, pct: 45 },
  { name: "Fat", grams: 65, pct: 25 },
];

export const TOP_PROGRESS: ClientProgressRow[] = [
  { id: "c1", name: "Sara El Amrani", service: "diet+gym", adherence: 94, weightDelta: -3.2, streak: 28, status: "on-track" },
  { id: "c2", name: "Youssef Bennani", service: "gym", adherence: 91, weightDelta: -1.4, streak: 22, status: "on-track" },
  { id: "c3", name: "Imane Tazi", service: "diet", adherence: 88, weightDelta: -2.6, streak: 19, status: "on-track" },
  { id: "c4", name: "Karim Idrissi", service: "diet+gym", adherence: 84, weightDelta: -1.8, streak: 14, status: "on-track" },
  { id: "c5", name: "Nadia Cherkaoui", service: "diet", adherence: 72, weightDelta: -0.4, streak: 6, status: "at-risk" },
  { id: "c6", name: "Omar Fassi", service: "gym", adherence: 64, weightDelta: 0.3, streak: 2, status: "at-risk" },
  { id: "c7", name: "Layla Berrada", service: "diet", adherence: 48, weightDelta: 0.8, streak: 0, status: "off-track" },
];

export const SERVICE_MIX: ServiceMix[] = [
  { label: "Diet", value: 22, color: "hsl(var(--primary))" },
  { label: "Gym", value: 14, color: "hsl(var(--chart-2, 168 70% 45%))" },
  { label: "Classes", value: 8, color: "hsl(var(--chart-3, 38 90% 55%))" },
];

export const FLAG_BUCKETS: FlagBucket[] = [
  { label: "Missed meals", count: 18 },
  { label: "Over-calorie", count: 12 },
  { label: "Low protein", count: 9 },
  { label: "Skipped workout", count: 7 },
  { label: "No weigh-in", count: 5 },
];

export function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
