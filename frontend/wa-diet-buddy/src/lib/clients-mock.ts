export type ServiceType = "diet" | "gym" | "classes";
export type ClientStatus = "active" | "paused" | "lead";

export interface ClientGoal {
  type: "weight-loss" | "muscle-gain" | "maintenance" | "clinical";
  targetWeight?: number;
  targetDate?: string;
}

export interface ClientMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  time: string;
  kind: "meal" | "exercise" | "weight";
  title: string;
  detail: string;
  kcal?: number;
  flagged?: boolean;
}

export interface MealPlanSummary {
  id: string;
  name: string;
  status: "active" | "draft" | "ended";
  startDate: string;
  endDate?: string;
  dailyKcal: number;
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "due" | "overdue";
  package: string;
}

export interface ClientFile {
  id: string;
  name: string;
  kind: "lab" | "photo" | "document";
  uploadedAt: string;
  sizeKb: number;
}

export interface ClientRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatarInitials: string;
  serviceType: ServiceType[];
  status: ClientStatus;
  joinedAt: string;
  lastActivity: string;
  // anthropometrics
  age: number;
  sex: "F" | "M";
  heightCm: number;
  weightKg: number;
  startWeightKg: number;
  targetWeightKg: number;
  activityFactor: number;
  // computed-ish
  bmr: number;
  targets: ClientMacros;
  todayConsumed: ClientMacros;
  adherencePct: number;
  // lifestyle
  occupation: string;
  sleepHours: number;
  dietaryPrefs: string[];
  allergies: string[];
  // clinical
  medicalHistory: string[];
  labs: { name: string; value: string; reference: string; date: string }[];
  nutritionDiagnosis: string;
  adimeNotes: { date: string; note: string }[];
  // satellite
  goal: ClientGoal;
  journal: JournalEntry[];
  plans: MealPlanSummary[];
  payments: PaymentRecord[];
  files: ClientFile[];
  outstandingBalanceUsd: number;
}

function bmi(heightCm: number, weightKg: number) {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

export function calcBMI(c: ClientRecord) {
  return bmi(c.heightCm, c.weightKg);
}

export function bmiBand(value: number) {
  if (value < 18.5) return { label: "Underweight", tone: "info" as const };
  if (value < 25) return { label: "Healthy", tone: "success" as const };
  if (value < 30) return { label: "Overweight", tone: "warning" as const };
  return { label: "Obese", tone: "destructive" as const };
}

export const CLIENTS: ClientRecord[] = [
  {
    id: "c-001",
    name: "Rana Khoury",
    phone: "+961 71 234 567",
    email: "rana.khoury@example.com",
    avatarInitials: "RK",
    serviceType: ["diet", "gym"],
    status: "active",
    joinedAt: "2025-02-14",
    lastActivity: "4 minutes ago",
    age: 32,
    sex: "F",
    heightCm: 168,
    weightKg: 71.4,
    startWeightKg: 78.2,
    targetWeightKg: 64,
    activityFactor: 1.55,
    bmr: 1454,
    targets: { calories: 1650, protein: 130, carbs: 170, fat: 55 },
    todayConsumed: { calories: 1180, protein: 92, carbs: 118, fat: 41 },
    adherencePct: 88,
    occupation: "Architect",
    sleepHours: 7,
    dietaryPrefs: ["Mediterranean", "Low added sugar"],
    allergies: ["Peanuts"],
    medicalHistory: ["PCOS (managed)", "Iron-deficiency anemia (resolved)"],
    labs: [
      { name: "HbA1c", value: "5.4%", reference: "<5.7%", date: "2025-05-04" },
      { name: "Ferritin", value: "48 ng/mL", reference: "30–200", date: "2025-05-04" },
      { name: "Vitamin D", value: "22 ng/mL", reference: "30–80", date: "2025-05-04" },
    ],
    nutritionDiagnosis:
      "Suboptimal energy intake related to irregular meal timing as evidenced by 7-day food log averaging 1,250 kcal vs. 1,650 kcal target.",
    adimeNotes: [
      { date: "2025-06-10", note: "Re-introduced bedtime snack to improve sleep + recovery. Tolerating well." },
      { date: "2025-05-27", note: "Down 1.4 kg in 3 weeks. Continue current plan, monitor energy on training days." },
    ],
    goal: { type: "weight-loss", targetWeight: 64, targetDate: "2025-09-30" },
    journal: [
      { id: "j-1", date: "2025-06-17", time: "08:15", kind: "meal", title: "Labneh + za'atar manoushe ½", detail: "AI: half manoushe, 30g labneh", kcal: 380 },
      { id: "j-2", date: "2025-06-17", time: "12:40", kind: "meal", title: "Grilled chicken tabbouleh bowl", detail: "AI: 150g chicken, 1 cup tabbouleh, ½ cup hummus", kcal: 520 },
      { id: "j-3", date: "2025-06-17", time: "16:00", kind: "meal", title: "Apple + 20g almonds", detail: "AI: medium apple, 20g almonds", kcal: 280 },
      { id: "j-4", date: "2025-06-16", time: "18:30", kind: "exercise", title: "Strength session", detail: "Lower body · 52 min · 320 kcal" },
      { id: "j-5", date: "2025-06-16", time: "07:00", kind: "weight", title: "Morning weigh-in", detail: "71.4 kg (-0.3 vs last week)" },
    ],
    plans: [
      { id: "p-1", name: "Cut · Phase 2", status: "active", startDate: "2025-06-02", endDate: "2025-06-29", dailyKcal: 1650 },
      { id: "p-2", name: "Cut · Phase 1", status: "ended", startDate: "2025-05-05", endDate: "2025-06-01", dailyKcal: 1750 },
    ],
    payments: [
      { id: "pay-1", date: "2025-06-01", amount: 220, status: "paid", package: "Diet + Gym · Monthly" },
      { id: "pay-2", date: "2025-05-01", amount: 220, status: "paid", package: "Diet + Gym · Monthly" },
    ],
    files: [
      { id: "f-1", name: "Lab results — May 2025.pdf", kind: "lab", uploadedAt: "2025-05-05", sizeKb: 412 },
      { id: "f-2", name: "Progress photo · front.jpg", kind: "photo", uploadedAt: "2025-06-02", sizeKb: 1820 },
    ],
    outstandingBalanceUsd: 0,
  },
  {
    id: "c-002",
    name: "Karim Aoun",
    phone: "+961 70 998 112",
    email: "karim.aoun@example.com",
    avatarInitials: "KA",
    serviceType: ["gym"],
    status: "active",
    joinedAt: "2025-04-21",
    lastActivity: "1 hour ago",
    age: 28,
    sex: "M",
    heightCm: 181,
    weightKg: 83.1,
    startWeightKg: 78.0,
    targetWeightKg: 86,
    activityFactor: 1.7,
    bmr: 1872,
    targets: { calories: 3180, protein: 175, carbs: 360, fat: 90 },
    todayConsumed: { calories: 2240, protein: 138, carbs: 248, fat: 64 },
    adherencePct: 92,
    occupation: "Software engineer",
    sleepHours: 6.5,
    dietaryPrefs: ["High protein"],
    allergies: [],
    medicalHistory: [],
    labs: [],
    nutritionDiagnosis: "Inadequate energy intake on training days relative to lean-mass goals.",
    adimeNotes: [
      { date: "2025-06-12", note: "Increased carbs on lift days by ~40g. Energy + lifts trending up." },
    ],
    goal: { type: "muscle-gain", targetWeight: 86, targetDate: "2025-10-15" },
    journal: [
      { id: "j-1", date: "2025-06-17", time: "07:30", kind: "exercise", title: "Push day", detail: "Bench, OHP, dips · 58 min · 410 kcal" },
      { id: "j-2", date: "2025-06-17", time: "09:00", kind: "meal", title: "Oats + whey + banana", detail: "AI: 80g oats, 1 scoop whey, 1 banana", kcal: 540 },
    ],
    plans: [
      { id: "p-1", name: "Lean bulk · Week 5", status: "active", startDate: "2025-05-12", endDate: "2025-07-06", dailyKcal: 3180 },
    ],
    payments: [
      { id: "pay-1", date: "2025-06-01", amount: 140, status: "paid", package: "Gym · Monthly" },
    ],
    files: [],
    outstandingBalanceUsd: 0,
  },
  {
    id: "c-003",
    name: "Maya Saade",
    phone: "+961 76 445 209",
    avatarInitials: "MS",
    serviceType: ["diet"],
    status: "active",
    joinedAt: "2025-01-08",
    lastActivity: "4 minutes ago",
    age: 41,
    sex: "F",
    heightCm: 162,
    weightKg: 68.0,
    startWeightKg: 74.5,
    targetWeightKg: 62,
    activityFactor: 1.375,
    bmr: 1342,
    targets: { calories: 1500, protein: 110, carbs: 150, fat: 50 },
    todayConsumed: { calories: 1820, protein: 88, carbs: 198, fat: 72 },
    adherencePct: 71,
    occupation: "Teacher",
    sleepHours: 6,
    dietaryPrefs: ["Vegetarian-leaning"],
    allergies: ["Shellfish"],
    medicalHistory: ["Hypothyroidism (treated)"],
    labs: [{ name: "TSH", value: "2.1 mIU/L", reference: "0.4–4.0", date: "2025-04-18" }],
    nutritionDiagnosis: "Excessive evening carbohydrate intake related to evening grazing pattern.",
    adimeNotes: [
      { date: "2025-06-14", note: "Discussed swap for evening dessert with fruit + 15g nuts. Will try this week." },
    ],
    goal: { type: "weight-loss", targetWeight: 62, targetDate: "2025-12-01" },
    journal: [
      { id: "j-1", date: "2025-06-17", time: "20:10", kind: "meal", title: "Kibbeh + salad", detail: "AI: 3 kibbeh, mixed salad, tahini", kcal: 612, flagged: true },
    ],
    plans: [
      { id: "p-1", name: "Balanced 1500", status: "active", startDate: "2025-05-20", endDate: "2025-06-30", dailyKcal: 1500 },
    ],
    payments: [
      { id: "pay-1", date: "2025-06-08", amount: 110, status: "due", package: "Diet · Monthly" },
    ],
    files: [],
    outstandingBalanceUsd: 110,
  },
  {
    id: "c-004",
    name: "Nour El-Hage",
    phone: "+961 78 112 904",
    email: "nour.elhage@example.com",
    avatarInitials: "NE",
    serviceType: ["diet", "gym"],
    status: "active",
    joinedAt: "2024-11-02",
    lastActivity: "2 hours ago",
    age: 36,
    sex: "F",
    heightCm: 170,
    weightKg: 65.2,
    startWeightKg: 72.0,
    targetWeightKg: 63,
    activityFactor: 1.55,
    bmr: 1421,
    targets: { calories: 1850, protein: 135, carbs: 195, fat: 60 },
    todayConsumed: { calories: 980, protein: 70, carbs: 96, fat: 38 },
    adherencePct: 84,
    occupation: "Marketing director",
    sleepHours: 7.5,
    dietaryPrefs: ["Pescatarian"],
    allergies: [],
    medicalHistory: [],
    labs: [],
    nutritionDiagnosis: "Maintenance phase, body recomposition focus.",
    adimeNotes: [],
    goal: { type: "maintenance", targetWeight: 63, targetDate: "2025-12-31" },
    journal: [
      { id: "j-1", date: "2025-06-17", time: "13:00", kind: "meal", title: "Salmon poke bowl", detail: "AI: 130g salmon, rice, edamame, avocado", kcal: 580 },
    ],
    plans: [
      { id: "p-1", name: "Recomp · 1850", status: "active", startDate: "2025-06-01", endDate: "2025-07-31", dailyKcal: 1850 },
    ],
    payments: [
      { id: "pay-1", date: "2025-06-01", amount: 220, status: "paid", package: "Diet + Gym · Monthly" },
    ],
    files: [],
    outstandingBalanceUsd: 0,
  },
  {
    id: "c-005",
    name: "Tarek Mansour",
    phone: "+961 70 778 220",
    avatarInitials: "TM",
    serviceType: ["gym"],
    status: "active",
    joinedAt: "2025-05-19",
    lastActivity: "3 hours ago",
    age: 45,
    sex: "M",
    heightCm: 178,
    weightKg: 96.4,
    startWeightKg: 102.3,
    targetWeightKg: 88,
    activityFactor: 1.55,
    bmr: 1923,
    targets: { calories: 2400, protein: 165, carbs: 240, fat: 80 },
    todayConsumed: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    adherencePct: 64,
    occupation: "Restaurant owner",
    sleepHours: 6,
    dietaryPrefs: ["Mediterranean"],
    allergies: [],
    medicalHistory: ["Hypertension (controlled)", "Pre-diabetes"],
    labs: [
      { name: "HbA1c", value: "6.1%", reference: "<5.7%", date: "2025-05-22" },
      { name: "LDL", value: "138 mg/dL", reference: "<100", date: "2025-05-22" },
    ],
    nutritionDiagnosis: "Excessive saturated fat intake related to dining-out frequency, contributing to elevated LDL.",
    adimeNotes: [],
    goal: { type: "weight-loss", targetWeight: 88, targetDate: "2025-12-15" },
    journal: [],
    plans: [
      { id: "p-1", name: "Onboarding plan", status: "draft", startDate: "2025-06-18", dailyKcal: 2400 },
    ],
    payments: [
      { id: "pay-1", date: "2025-06-05", amount: 140, status: "overdue", package: "Gym · Monthly" },
    ],
    files: [
      { id: "f-1", name: "Lab results — May 2025.pdf", kind: "lab", uploadedAt: "2025-05-25", sizeKb: 380 },
    ],
    outstandingBalanceUsd: 140,
  },
  {
    id: "c-006",
    name: "Layan Issa",
    phone: "+961 71 552 008",
    email: "layan.issa@example.com",
    avatarInitials: "LI",
    serviceType: ["diet"],
    status: "paused",
    joinedAt: "2024-09-12",
    lastActivity: "9 days ago",
    age: 26,
    sex: "F",
    heightCm: 165,
    weightKg: 58.0,
    startWeightKg: 62.0,
    targetWeightKg: 56,
    activityFactor: 1.375,
    bmr: 1318,
    targets: { calories: 1450, protein: 105, carbs: 150, fat: 48 },
    todayConsumed: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    adherencePct: 0,
    occupation: "Graphic designer",
    sleepHours: 8,
    dietaryPrefs: ["Vegan"],
    allergies: ["Soy"],
    medicalHistory: [],
    labs: [],
    nutritionDiagnosis: "Plan paused at client request — travel.",
    adimeNotes: [{ date: "2025-06-08", note: "Paused for 3 weeks, traveling. Will resume July 1." }],
    goal: { type: "weight-loss", targetWeight: 56, targetDate: "2025-09-01" },
    journal: [],
    plans: [
      { id: "p-1", name: "Vegan balanced 1450", status: "ended", startDate: "2025-04-10", endDate: "2025-06-07", dailyKcal: 1450 },
    ],
    payments: [],
    files: [],
    outstandingBalanceUsd: 0,
  },
  {
    id: "c-007",
    name: "Walid Rahme",
    phone: "+961 76 100 884",
    avatarInitials: "WR",
    serviceType: ["diet", "gym"],
    status: "active",
    joinedAt: "2025-03-04",
    lastActivity: "yesterday",
    age: 38,
    sex: "M",
    heightCm: 175,
    weightKg: 89.2,
    startWeightKg: 95.0,
    targetWeightKg: 82,
    activityFactor: 1.55,
    bmr: 1812,
    targets: { calories: 2300, protein: 160, carbs: 230, fat: 75 },
    todayConsumed: { calories: 1640, protein: 112, carbs: 168, fat: 54 },
    adherencePct: 79,
    occupation: "Lawyer",
    sleepHours: 6.5,
    dietaryPrefs: [],
    allergies: [],
    medicalHistory: ["Lower back pain"],
    labs: [],
    nutritionDiagnosis: "Energy intake aligned with goals; focus on consistency.",
    adimeNotes: [],
    goal: { type: "weight-loss", targetWeight: 82, targetDate: "2025-10-31" },
    journal: [],
    plans: [
      { id: "p-1", name: "Cut · 2300", status: "active", startDate: "2025-05-15", endDate: "2025-07-15", dailyKcal: 2300 },
    ],
    payments: [
      { id: "pay-1", date: "2025-06-01", amount: 220, status: "paid", package: "Diet + Gym · Monthly" },
    ],
    files: [],
    outstandingBalanceUsd: 0,
  },
  {
    id: "c-008",
    name: "Sara Younes",
    phone: "+961 78 660 415",
    avatarInitials: "SY",
    serviceType: [],
    status: "lead",
    joinedAt: "2025-06-15",
    lastActivity: "yesterday",
    age: 30,
    sex: "F",
    heightCm: 167,
    weightKg: 70,
    startWeightKg: 70,
    targetWeightKg: 64,
    activityFactor: 1.375,
    bmr: 1402,
    targets: { calories: 1600, protein: 115, carbs: 165, fat: 52 },
    todayConsumed: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    adherencePct: 0,
    occupation: "—",
    sleepHours: 7,
    dietaryPrefs: [],
    allergies: [],
    medicalHistory: [],
    labs: [],
    nutritionDiagnosis: "Initial consultation scheduled.",
    adimeNotes: [],
    goal: { type: "weight-loss" },
    journal: [],
    plans: [],
    payments: [],
    files: [],
    outstandingBalanceUsd: 0,
  },
];

export function getClient(id: string) {
  return CLIENTS.find((c) => c.id === id);
}

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  diet: "Diet",
  gym: "Gym",
  classes: "Classes",
};
