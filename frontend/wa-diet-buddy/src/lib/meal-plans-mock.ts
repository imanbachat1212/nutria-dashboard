export type MealSlot = "breakfast" | "snack-am" | "lunch" | "snack-pm" | "dinner";
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem {
  id: string;
  name: string;
  amount: string; // e.g. "120 g", "1 cup"
  macros: Macros;
  tags?: string[]; // "lebanese", "vegan", "high-protein", etc.
}

export interface MealEntry {
  id: string;
  slot: MealSlot;
  title: string;
  time: string; // "08:00"
  items: FoodItem[];
  notes?: string;
}

export interface DayPlan {
  day: DayKey;
  meals: MealEntry[];
}

export type PlanStatus = "active" | "draft" | "ended" | "shared";

export interface MealPlan {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  status: PlanStatus;
  goal: "weight-loss" | "muscle-gain" | "maintenance" | "clinical";
  startDate: string;
  endDate: string;
  targets: Macros;
  adherencePct: number;
  days: DayPlan[];
  updatedAt: string;
  sharedVia?: ("whatsapp" | "email" | "app")[];
}

export interface SwapSuggestion {
  id: string;
  forSlot: MealSlot;
  name: string;
  macros: Macros;
  reason: string;
  tag: "lebanese" | "high-protein" | "low-carb" | "vegan" | "quick";
}

export const SLOT_META: Record<MealSlot, { label: string; emoji: string; defaultTime: string }> = {
  breakfast: { label: "Breakfast", emoji: "🌅", defaultTime: "08:00" },
  "snack-am": { label: "AM Snack", emoji: "🥜", defaultTime: "10:30" },
  lunch: { label: "Lunch", emoji: "🥗", defaultTime: "13:00" },
  "snack-pm": { label: "PM Snack", emoji: "🍎", defaultTime: "16:30" },
  dinner: { label: "Dinner", emoji: "🍽️", defaultTime: "20:00" },
};

export const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

export function sumMacros(items: { macros: Macros }[]): Macros {
  return items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.macros.kcal,
      protein: a.protein + i.macros.protein,
      carbs: a.carbs + i.macros.carbs,
      fat: a.fat + i.macros.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function mealMacros(m: MealEntry): Macros {
  return sumMacros(m.items);
}

export function dayMacros(d: DayPlan): Macros {
  return sumMacros(d.meals.map((m) => ({ macros: mealMacros(m) })));
}

// ---------- Helpers / generators ----------

const f = (
  id: string,
  name: string,
  amount: string,
  kcal: number,
  p: number,
  c: number,
  fat: number,
  tags?: string[],
): FoodItem => ({ id, name, amount, macros: { kcal, protein: p, carbs: c, fat }, tags });

function buildWeek(template: Partial<Record<DayKey, MealEntry[]>>, fallback: MealEntry[]): DayPlan[] {
  return DAYS.map(({ key }) => ({
    day: key,
    meals: (template[key] ?? fallback).map((m, idx) => ({ ...m, id: `${key}-${idx}-${m.slot}` })),
  }));
}

export const SAMPLE_DAY: MealEntry[] = [
  {
    id: "sample-breakfast",
    slot: "breakfast",
    title: "Labneh manakish + cucumber",
    time: "08:00",
    items: [
      f("sm-a", "Whole-wheat manakish (½)", "60 g", 220, 7, 32, 6, ["lebanese"]),
      f("sm-b", "Labneh", "30 g", 75, 4, 2, 5),
      f("sm-c", "Cucumber + mint", "100 g", 16, 1, 3, 0),
      f("sm-d", "Black coffee", "1 cup", 5, 0, 0, 0),
    ],
  },
  {
    id: "sample-snack-am",
    slot: "snack-am",
    title: "Greek yogurt + berries",
    time: "10:30",
    items: [
      f("sm-e", "Greek yogurt 2%", "170 g", 130, 17, 8, 3, ["high-protein"]),
      f("sm-f", "Mixed berries", "80 g", 40, 1, 9, 0),
    ],
  },
  {
    id: "sample-lunch",
    slot: "lunch",
    title: "Grilled chicken tabbouleh bowl",
    time: "13:00",
    items: [
      f("sm-g", "Grilled chicken breast", "150 g", 240, 45, 0, 6, ["high-protein", "lebanese"]),
      f("sm-h", "Tabbouleh", "1 cup", 180, 4, 18, 11, ["lebanese"]),
      f("sm-i", "Hummus", "60 g", 160, 5, 14, 9, ["lebanese"]),
      f("sm-j", "Whole-wheat pita (¼)", "15 g", 40, 1, 8, 0),
    ],
  },
  {
    id: "sample-snack-pm",
    slot: "snack-pm",
    title: "Apple + almonds",
    time: "16:30",
    items: [
      f("sm-k", "Apple, medium", "180 g", 95, 0, 25, 0),
      f("sm-l", "Raw almonds", "20 g", 120, 4, 4, 11),
    ],
  },
  {
    id: "sample-dinner",
    slot: "dinner",
    title: "Baked salmon + roasted veg",
    time: "20:00",
    items: [
      f("sm-m", "Salmon fillet", "140 g", 280, 30, 0, 17, ["high-protein"]),
      f("sm-n", "Roasted zucchini + peppers", "200 g", 110, 3, 14, 5),
      f("sm-o", "Quinoa", "½ cup cooked", 110, 4, 20, 2),
    ],
  },
];

export function blankDays(): DayPlan[] {
  return DAYS.map(({ key }) => ({
    day: key,
    meals: (Object.keys(SLOT_META) as MealSlot[]).map((slot, idx) => ({
      id: `${key}-${idx}-${slot}`,
      slot,
      title: `${SLOT_META[slot].label}`,
      time: SLOT_META[slot].defaultTime,
      items: [],
    })),
  }));
}

export function daysFromTemplate(targets: Macros): DayPlan[] {
  const baseKcal = SAMPLE_DAY.reduce((acc, m) => acc + mealMacros(m).kcal, 0);
  const scale = targets.kcal ? targets.kcal / baseKcal : 1;
  const scaled: MealEntry[] = SAMPLE_DAY.map((meal) => ({
    ...meal,
    id: `m-${Date.now()}-${meal.slot}`,
    items: meal.items.map((it) => ({
      ...it,
      id: `f-${Date.now()}-${it.id}`,
      macros: {
        kcal: Math.round(it.macros.kcal * scale),
        protein: Math.round(it.macros.protein * scale),
        carbs: Math.round(it.macros.carbs * scale),
        fat: Math.round(it.macros.fat * scale),
      },
    })),
  }));
  return buildWeek({}, scaled);
}

// ---------- Mock data ----------

const ranaMonday: MealEntry[] = [
  {
    id: "tmp",
    slot: "breakfast",
    title: "Labneh manakish + cucumber",
    time: "08:00",
    items: [
      f("a", "Whole-wheat manakish (½)", "60 g", 220, 7, 32, 6, ["lebanese"]),
      f("b", "Labneh", "30 g", 75, 4, 2, 5),
      f("c", "Cucumber + mint", "100 g", 16, 1, 3, 0),
      f("d", "Black coffee", "1 cup", 5, 0, 0, 0),
    ],
  },
  {
    id: "tmp",
    slot: "snack-am",
    title: "Greek yogurt + berries",
    time: "10:30",
    items: [
      f("a", "Greek yogurt 2%", "170 g", 130, 17, 8, 3, ["high-protein"]),
      f("b", "Mixed berries", "80 g", 40, 1, 9, 0),
    ],
  },
  {
    id: "tmp",
    slot: "lunch",
    title: "Grilled chicken tabbouleh bowl",
    time: "13:00",
    items: [
      f("a", "Grilled chicken breast", "150 g", 240, 45, 0, 6, ["high-protein", "lebanese"]),
      f("b", "Tabbouleh", "1 cup", 180, 4, 18, 11, ["lebanese"]),
      f("c", "Hummus", "60 g", 160, 5, 14, 9, ["lebanese"]),
      f("d", "Whole-wheat pita (¼)", "15 g", 40, 1, 8, 0),
    ],
    notes: "AI confidence 94% — swap chicken for fish on Wed/Fri if available.",
  },
  {
    id: "tmp",
    slot: "snack-pm",
    title: "Apple + almonds",
    time: "16:30",
    items: [
      f("a", "Apple, medium", "180 g", 95, 0, 25, 0),
      f("b", "Raw almonds", "20 g", 120, 4, 4, 11),
    ],
  },
  {
    id: "tmp",
    slot: "dinner",
    title: "Baked salmon + roasted veg",
    time: "20:00",
    items: [
      f("a", "Salmon fillet", "140 g", 280, 30, 0, 17, ["high-protein"]),
      f("b", "Roasted zucchini + peppers", "200 g", 110, 3, 14, 5),
      f("c", "Quinoa", "½ cup cooked", 110, 4, 20, 2),
    ],
  },
];

const ranaTuesday: MealEntry[] = [
  {
    id: "tmp",
    slot: "breakfast",
    title: "Overnight oats + whey",
    time: "08:00",
    items: [
      f("a", "Rolled oats", "50 g", 190, 7, 32, 4),
      f("b", "Whey protein", "1 scoop", 120, 24, 3, 1, ["high-protein"]),
      f("c", "Banana ½", "60 g", 55, 1, 14, 0),
      f("d", "Chia seeds", "10 g", 50, 2, 4, 3),
    ],
  },
  ...ranaMonday.slice(1),
];

export const MEAL_PLANS: MealPlan[] = [
  {
    id: "mp-001",
    name: "Cut · Phase 2",
    clientId: "c-001",
    clientName: "Rana Khoury",
    clientInitials: "RK",
    status: "active",
    goal: "weight-loss",
    startDate: "2026-06-02",
    endDate: "2026-06-29",
    targets: { kcal: 1650, protein: 130, carbs: 170, fat: 55 },
    adherencePct: 88,
    days: buildWeek({ mon: ranaMonday, tue: ranaTuesday }, ranaMonday),
    updatedAt: "2 hours ago",
    sharedVia: ["whatsapp", "app"],
  },
  {
    id: "mp-002",
    name: "Lean bulk · Week 5",
    clientId: "c-002",
    clientName: "Karim Aoun",
    clientInitials: "KA",
    status: "active",
    goal: "muscle-gain",
    startDate: "2026-05-12",
    endDate: "2026-07-06",
    targets: { kcal: 3180, protein: 175, carbs: 360, fat: 90 },
    adherencePct: 92,
    days: buildWeek({}, [
      {
        id: "tmp",
        slot: "breakfast",
        title: "Oats + whey + banana",
        time: "07:30",
        items: [
          f("a", "Rolled oats", "80 g", 300, 11, 51, 6),
          f("b", "Whey", "1 scoop", 120, 24, 3, 1),
          f("c", "Banana", "120 g", 110, 1, 28, 0),
          f("d", "Peanut butter", "20 g", 120, 5, 4, 10),
        ],
      },
      {
        id: "tmp",
        slot: "snack-am",
        title: "Cottage cheese + honey",
        time: "10:30",
        items: [f("a", "Cottage cheese", "200 g", 200, 25, 8, 8), f("b", "Honey", "15 g", 45, 0, 12, 0)],
      },
      {
        id: "tmp",
        slot: "lunch",
        title: "Beef + rice + greens",
        time: "13:00",
        items: [
          f("a", "Lean beef", "180 g", 360, 50, 0, 16),
          f("b", "White rice", "1.5 cups", 310, 6, 67, 1),
          f("c", "Mixed greens + olive oil", "150 g", 130, 3, 7, 11),
        ],
      },
      {
        id: "tmp",
        slot: "snack-pm",
        title: "Pre-workout shake",
        time: "16:30",
        items: [f("a", "Whey + oats shake", "1 shake", 320, 28, 40, 5)],
      },
      {
        id: "tmp",
        slot: "dinner",
        title: "Salmon + sweet potato",
        time: "20:00",
        items: [
          f("a", "Salmon", "180 g", 360, 38, 0, 22),
          f("b", "Sweet potato", "250 g", 220, 4, 51, 0),
          f("c", "Avocado ½", "80 g", 130, 2, 7, 12),
        ],
      },
    ]),
    updatedAt: "yesterday",
    sharedVia: ["whatsapp"],
  },
  {
    id: "mp-003",
    name: "Balanced 1500",
    clientId: "c-003",
    clientName: "Maya Saade",
    clientInitials: "MS",
    status: "active",
    goal: "weight-loss",
    startDate: "2026-05-20",
    endDate: "2026-06-30",
    targets: { kcal: 1500, protein: 110, carbs: 150, fat: 50 },
    adherencePct: 71,
    days: buildWeek({}, ranaMonday),
    updatedAt: "3 days ago",
    sharedVia: ["app"],
  },
  {
    id: "mp-004",
    name: "Recomp · 1850",
    clientId: "c-004",
    clientName: "Nour El-Hage",
    clientInitials: "NE",
    status: "active",
    goal: "maintenance",
    startDate: "2026-06-01",
    endDate: "2026-07-31",
    targets: { kcal: 1850, protein: 135, carbs: 195, fat: 60 },
    adherencePct: 84,
    days: buildWeek({}, ranaMonday),
    updatedAt: "1 hour ago",
    sharedVia: ["whatsapp", "email"],
  },
  {
    id: "mp-005",
    name: "Onboarding · Tarek",
    clientId: "c-005",
    clientName: "Tarek Mansour",
    clientInitials: "TM",
    status: "draft",
    goal: "clinical",
    startDate: "2026-06-22",
    endDate: "2026-07-22",
    targets: { kcal: 2400, protein: 165, carbs: 240, fat: 80 },
    adherencePct: 0,
    days: buildWeek({}, ranaMonday),
    updatedAt: "Just now",
  },
  {
    id: "mp-006",
    name: "Vegan balanced 1450",
    clientId: "c-006",
    clientName: "Layan Issa",
    clientInitials: "LI",
    status: "ended",
    goal: "weight-loss",
    startDate: "2026-04-10",
    endDate: "2026-06-07",
    targets: { kcal: 1450, protein: 105, carbs: 150, fat: 48 },
    adherencePct: 0,
    days: buildWeek({}, ranaMonday),
    updatedAt: "2 weeks ago",
  },
];

export const SWAP_POOL: SwapSuggestion[] = [
  {
    id: "s-1",
    forSlot: "breakfast",
    name: "Foul moudammas + tomato",
    macros: { kcal: 310, protein: 16, carbs: 38, fat: 9 },
    reason: "Same fiber, +5g protein, Lebanese",
    tag: "lebanese",
  },
  {
    id: "s-2",
    forSlot: "lunch",
    name: "Grilled fish + freekeh",
    macros: { kcal: 520, protein: 42, carbs: 48, fat: 14 },
    reason: "Lower fat, similar protein",
    tag: "high-protein",
  },
  {
    id: "s-3",
    forSlot: "snack-pm",
    name: "Cottage cheese + cucumber",
    macros: { kcal: 140, protein: 16, carbs: 6, fat: 4 },
    reason: "Higher protein, lower carbs",
    tag: "high-protein",
  },
  {
    id: "s-4",
    forSlot: "dinner",
    name: "Lentil mjadara + salad",
    macros: { kcal: 480, protein: 18, carbs: 72, fat: 12 },
    reason: "Plant-based, fiber-rich",
    tag: "vegan",
  },
  {
    id: "s-5",
    forSlot: "snack-am",
    name: "Boiled eggs (2) + olives",
    macros: { kcal: 180, protein: 14, carbs: 1, fat: 14 },
    reason: "Low-carb, fast",
    tag: "low-carb",
  },
  {
    id: "s-6",
    forSlot: "breakfast",
    name: "Shakshuka (small)",
    macros: { kcal: 290, protein: 18, carbs: 14, fat: 18 },
    reason: "Hot option, +protein",
    tag: "quick",
  },
];

export const PLAN_TEMPLATES = [
  { id: "t-1", name: "Mediterranean 1600", kcal: 1600, days: 7, tag: "Weight loss" },
  { id: "t-2", name: "High-protein 2000", kcal: 2000, days: 7, tag: "Recomp" },
  { id: "t-3", name: "Lean bulk 3000", kcal: 3000, days: 7, tag: "Muscle gain" },
  { id: "t-4", name: "Vegan balanced 1500", kcal: 1500, days: 7, tag: "Plant-based" },
  { id: "t-5", name: "Ramadan iftar/sohour", kcal: 1800, days: 30, tag: "Seasonal" },
  { id: "t-6", name: "PCOS-friendly 1700", kcal: 1700, days: 7, tag: "Clinical" },
];
