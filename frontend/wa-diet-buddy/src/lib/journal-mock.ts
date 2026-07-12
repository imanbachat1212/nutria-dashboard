export type JournalKind = "meal" | "exercise" | "weight" | "hydration";
export type ReviewStatus = "pending" | "approved" | "edited" | "rejected";
export type Confidence = "high" | "medium" | "low";
export type FlagReason =
  | "portion-uncertain"
  | "missing-detail"
  | "macro-outlier"
  | "duplicate"
  | "image-unclear"
  | "off-plan";

export interface EstimatedItem {
  name: string;
  qty: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface JournalLog {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  kind: JournalKind;
  source: "whatsapp-text" | "whatsapp-photo" | "app";
  receivedAt: string; // ISO
  rawMessage: string;
  mealSlot?: "breakfast" | "lunch" | "snack" | "dinner";
  items: EstimatedItem[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  confidence: Confidence;
  status: ReviewStatus;
  flags: FlagReason[];
  note?: string;
  planTargetKcal?: number;
}

const now = new Date();
function iso(minsAgo: number) {
  return new Date(now.getTime() - minsAgo * 60_000).toISOString();
}

function totals(items: EstimatedItem[]) {
  return items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

const i1: EstimatedItem[] = [
  { name: "Manoushe za'atar", qty: "½ piece", kcal: 280, protein: 7, carbs: 38, fat: 10 },
  { name: "Labneh", qty: "30 g", kcal: 55, protein: 3, carbs: 2, fat: 4 },
  { name: "Black tea, unsweetened", qty: "1 cup", kcal: 2, protein: 0, carbs: 0, fat: 0 },
];

const i2: EstimatedItem[] = [
  { name: "Grilled chicken breast", qty: "150 g", kcal: 248, protein: 46, carbs: 0, fat: 5 },
  { name: "Tabbouleh", qty: "1 cup", kcal: 170, protein: 4, carbs: 22, fat: 8 },
  { name: "Hummus", qty: "½ cup", kcal: 200, protein: 6, carbs: 18, fat: 12 },
];

const i3: EstimatedItem[] = [
  { name: "Kibbeh (fried)", qty: "3 pieces", kcal: 420, protein: 18, carbs: 28, fat: 25 },
  { name: "Mixed salad", qty: "1 plate", kcal: 90, protein: 3, carbs: 9, fat: 5 },
  { name: "Tahini sauce", qty: "2 tbsp", kcal: 178, protein: 5, carbs: 6, fat: 16 },
];

const i4: EstimatedItem[] = [
  { name: "Oats", qty: "80 g", kcal: 304, protein: 11, carbs: 54, fat: 5 },
  { name: "Whey protein", qty: "1 scoop", kcal: 120, protein: 24, carbs: 3, fat: 1 },
  { name: "Banana", qty: "1 medium", kcal: 105, protein: 1, carbs: 27, fat: 0 },
];

const i5: EstimatedItem[] = [
  { name: "Salmon, baked", qty: "130 g", kcal: 270, protein: 30, carbs: 0, fat: 16 },
  { name: "White rice", qty: "1 cup cooked", kcal: 205, protein: 4, carbs: 45, fat: 0 },
  { name: "Edamame", qty: "½ cup", kcal: 95, protein: 9, carbs: 7, fat: 4 },
  { name: "Avocado", qty: "¼ fruit", kcal: 80, protein: 1, carbs: 4, fat: 7 },
];

const i6: EstimatedItem[] = [
  { name: "Cappuccino, whole milk", qty: "1 large", kcal: 140, protein: 8, carbs: 12, fat: 7 },
  { name: "Chocolate croissant", qty: "1", kcal: 410, protein: 7, carbs: 45, fat: 22 },
];

const i7: EstimatedItem[] = [
  { name: "Apple", qty: "1 medium", kcal: 95, protein: 0, carbs: 25, fat: 0 },
  { name: "Almonds", qty: "20 g", kcal: 116, protein: 4, carbs: 4, fat: 10 },
];

const i8: EstimatedItem[] = [
  { name: "Beef shawarma plate", qty: "1 serving", kcal: 780, protein: 42, carbs: 58, fat: 38 },
  { name: "Garlic sauce", qty: "2 tbsp", kcal: 180, protein: 0, carbs: 1, fat: 20 },
  { name: "Pickles", qty: "small portion", kcal: 12, protein: 0, carbs: 2, fat: 0 },
];

export const JOURNAL_LOGS: JournalLog[] = [
  {
    id: "jr-001",
    clientId: "c-001",
    clientName: "Rana Khoury",
    clientInitials: "RK",
    kind: "meal",
    mealSlot: "breakfast",
    source: "whatsapp-text",
    receivedAt: iso(8),
    rawMessage: "had half a zaatar manouche with a bit of labneh and tea",
    items: i1,
    totals: totals(i1),
    confidence: "high",
    status: "pending",
    flags: [],
    planTargetKcal: 1650,
  },
  {
    id: "jr-002",
    clientId: "c-001",
    clientName: "Rana Khoury",
    clientInitials: "RK",
    kind: "meal",
    mealSlot: "lunch",
    source: "whatsapp-photo",
    receivedAt: iso(35),
    rawMessage: "[photo]",
    items: i2,
    totals: totals(i2),
    confidence: "medium",
    status: "pending",
    flags: ["portion-uncertain"],
    note: "Bowl size in photo is ambiguous — confirm chicken weight.",
    planTargetKcal: 1650,
  },
  {
    id: "jr-003",
    clientId: "c-003",
    clientName: "Maya Saade",
    clientInitials: "MS",
    kind: "meal",
    mealSlot: "dinner",
    source: "whatsapp-text",
    receivedAt: iso(55),
    rawMessage: "kibbeh and salad for dinner 🥲",
    items: i3,
    totals: totals(i3),
    confidence: "medium",
    status: "pending",
    flags: ["macro-outlier", "off-plan"],
    note: "Fat 46g — above evening cap of 20g. Off plan vs. balanced 1500.",
    planTargetKcal: 1500,
  },
  {
    id: "jr-004",
    clientId: "c-002",
    clientName: "Karim Aoun",
    clientInitials: "KA",
    kind: "meal",
    mealSlot: "breakfast",
    source: "whatsapp-text",
    receivedAt: iso(95),
    rawMessage: "post-workout: 80g oats, 1 scoop whey, banana",
    items: i4,
    totals: totals(i4),
    confidence: "high",
    status: "approved",
    flags: [],
    planTargetKcal: 3180,
  },
  {
    id: "jr-005",
    clientId: "c-004",
    clientName: "Nour El-Hage",
    clientInitials: "NE",
    kind: "meal",
    mealSlot: "lunch",
    source: "whatsapp-photo",
    receivedAt: iso(130),
    rawMessage: "[photo]",
    items: i5,
    totals: totals(i5),
    confidence: "high",
    status: "pending",
    flags: [],
    planTargetKcal: 1850,
  },
  {
    id: "jr-007",
    clientId: "c-001",
    clientName: "Rana Khoury",
    clientInitials: "RK",
    kind: "meal",
    mealSlot: "snack",
    source: "whatsapp-text",
    receivedAt: iso(220),
    rawMessage: "apple + 20g almonds",
    items: i7,
    totals: totals(i7),
    confidence: "high",
    status: "approved",
    flags: [],
    planTargetKcal: 1650,
  },
  {
    id: "jr-008",
    clientId: "c-005",
    clientName: "Tarek Mansour",
    clientInitials: "TM",
    kind: "meal",
    mealSlot: "lunch",
    source: "whatsapp-photo",
    receivedAt: iso(260),
    rawMessage: "[photo]",
    items: i8,
    totals: totals(i8),
    confidence: "medium",
    status: "pending",
    flags: ["macro-outlier", "off-plan", "portion-uncertain"],
    note: "Single meal = 40% of daily target. Sat fat very high vs. LDL goal.",
    planTargetKcal: 2400,
  },
  {
    id: "jr-009",
    clientId: "c-007",
    clientName: "Walid Rahme",
    clientInitials: "WR",
    kind: "weight",
    source: "whatsapp-text",
    receivedAt: iso(340),
    rawMessage: "89.2 this morning",
    items: [],
    totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    confidence: "high",
    status: "pending",
    flags: [],
  },
  {
    id: "jr-010",
    clientId: "c-002",
    clientName: "Karim Aoun",
    clientInitials: "KA",
    kind: "exercise",
    source: "app",
    receivedAt: iso(420),
    rawMessage: "Push day · 58 min · bench, OHP, dips",
    items: [],
    totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    confidence: "high",
    status: "approved",
    flags: [],
  },
  {
    id: "jr-011",
    clientId: "c-001",
    clientName: "Rana Khoury",
    clientInitials: "RK",
    kind: "meal",
    mealSlot: "snack",
    source: "whatsapp-text",
    receivedAt: iso(460),
    rawMessage: "apple + almonds (around 20g)",
    items: i7,
    totals: totals(i7),
    confidence: "medium",
    status: "rejected",
    flags: ["duplicate"],
    note: "Looks like a duplicate of the 4 PM log.",
    planTargetKcal: 1650,
  },
  {
    id: "jr-012",
    clientId: "c-004",
    clientName: "Nour El-Hage",
    clientInitials: "NE",
    kind: "hydration",
    source: "app",
    receivedAt: iso(520),
    rawMessage: "1.8 L water today",
    items: [],
    totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    confidence: "high",
    status: "approved",
    flags: [],
  },
];

export const FLAG_LABEL: Record<FlagReason, string> = {
  "portion-uncertain": "Portion uncertain",
  "missing-detail": "Missing detail",
  "macro-outlier": "Macro outlier",
  duplicate: "Possible duplicate",
  "image-unclear": "Image unclear",
  "off-plan": "Off plan",
};

export const SOURCE_LABEL: Record<JournalLog["source"], string> = {
  "whatsapp-text": "WhatsApp · text",
  "whatsapp-photo": "WhatsApp · photo",
  app: "In-app",
};

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (diff < 1) return "just now";
  if (diff < 60) return `${Math.round(diff)}m ago`;
  const h = diff / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
