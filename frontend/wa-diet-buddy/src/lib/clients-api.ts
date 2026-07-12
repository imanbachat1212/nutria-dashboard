import { api } from "./api";
import type {
  ClientRecord,
  ClientMacros,
  ServiceType,
  ClientStatus,
  ClientGoal,
} from "./clients-mock";

// ── Activity-level enum ↔ numeric factor (mirrors backend calc/targets.js) ──

const ACTIVITY_LEVEL_TO_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const FACTOR_TO_ACTIVITY_LEVEL: Record<number, string> = Object.fromEntries(
  Object.entries(ACTIVITY_LEVEL_TO_FACTOR).map(([k, v]) => [v, k]),
);

function factorToLevel(factor: number): string {
  return FACTOR_TO_ACTIVITY_LEVEL[factor] || "moderate";
}

// ── Enum mappings ──

function mapStatusFromAPI(api: string): ClientStatus {
  if (api === "inactive") return "paused";
  return api as ClientStatus;
}

function mapStatusToAPI(fe: ClientStatus): string {
  if (fe === "paused") return "inactive";
  return fe;
}

function mapSexFromAPI(api: string | undefined): "F" | "M" {
  return api === "male" ? "M" : "F";
}

function mapSexToAPI(fe: "F" | "M"): string {
  return fe === "M" ? "male" : "female";
}

function mapGoalFromAPI(api: string | undefined): ClientGoal["type"] {
  if (api === "lose") return "weight-loss";
  if (api === "gain") return "muscle-gain";
  return "maintenance";
}

function mapGoalToAPI(fe: ClientGoal["type"]): string {
  if (fe === "weight-loss") return "lose";
  if (fe === "muscle-gain") return "gain";
  return "maintain";
}

// ── Helpers ──

function ageFromDOB(dob: string | undefined): number {
  if (!dob) return 0;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── API → ClientRecord ──

interface APIClient {
  _id: string;
  phone: string;
  status: string;
  serviceType: string[];
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: string;
    sex?: string;
    height?: number;
    weight?: number;
    startWeight?: number;
    goalWeight?: number;
    activityLevel?: string;
    goal?: string;
    occupation?: string;
    sleepHours?: number;
    waterIntake?: number;
    dietaryPreferences?: string[];
    allergies?: string[];
    intolerances?: string[];
    foodsToAvoid?: string[];
  };
  targets?: {
    method?: string;
    bmr?: number;
    tee?: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
  clinical?: {
    labs?: { name: string; value: string; reference: string; date: string }[];
    medicalHistory?: string[];
    nutritionDiagnosis?: string;
    monitoring?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface APINote {
  _id: string;
  content: string;
  author: { _id: string; name: string };
  createdAt: string;
}

const zeroMacros: ClientMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function toClientRecord(c: APIClient): ClientRecord {
  const p = c.profile || {};
  const t = c.targets;
  const cl = c.clinical;
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unnamed";

  return {
    id: c._id,
    name,
    phone: c.phone,
    email: p.email,
    avatarInitials: initials(name),
    serviceType: (c.serviceType ?? []) as ServiceType[],
    status: mapStatusFromAPI(c.status),
    joinedAt: c.createdAt?.split("T")[0] || "",
    age: ageFromDOB(p.dateOfBirth),
    sex: mapSexFromAPI(p.sex),
    heightCm: p.height || 0,
    weightKg: p.weight || 0,
    startWeightKg: p.startWeight || p.weight || 0,
    targetWeightKg: p.goalWeight || p.weight || 0,
    activityFactor: ACTIVITY_LEVEL_TO_FACTOR[p.activityLevel || ""] || 1.55,
    bmr: t?.bmr || 0,
    targets: {
      calories: t?.calories || 0,
      protein: t?.protein || 0,
      carbs: t?.carbs || 0,
      fat: t?.fat || 0,
    },
    occupation: p.occupation || "—",
    sleepHours: p.sleepHours || 0,
    dietaryPrefs: p.dietaryPreferences || [],
    allergies: p.allergies || [],
    medicalHistory: cl?.medicalHistory || [],
    labs: (cl?.labs || []).map((l) => ({
      name: l.name,
      value: String(l.value),
      reference: l.reference || "",
      date: l.date || "",
    })),
    nutritionDiagnosis: cl?.nutritionDiagnosis || "",
    goal: {
      type: mapGoalFromAPI(p.goal),
      targetWeight: p.goalWeight,
      targetDate: undefined,
    },
    // from journal module — not wired yet
    todayConsumed: zeroMacros,
    adherencePct: 0,
    lastActivity: "",
    journal: [],
    // from mealplans module — not wired yet
    plans: [],
    // from billing module — not wired yet
    payments: [],
    outstandingBalanceUsd: 0,
    // from files/media — not wired yet
    files: [],
    // notes loaded separately
    adimeNotes: [],
  };
}

// ── Create/Update: ClientRecord form data → API body ──

interface CreatePayload {
  name: string;
  phone: string;
  email?: string;
  serviceType: ServiceType[];
  status: ClientStatus;
  age: number;
  sex: "F" | "M";
  heightCm: number;
  weightKg: number;
  startWeightKg: number;
  targetWeightKg: number;
  activityFactor: number;
  goalType: ClientGoal["type"];
  occupation: string;
  sleepHours: number;
  dietaryPrefs: string[];
  allergies: string[];
  medicalHistory: string[];
  overrideTargets: boolean;
  targets?: ClientMacros;
}

function toAPIBody(d: CreatePayload) {
  const nameParts = d.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - d.age);
  const dateOfBirth = dob.toISOString().split("T")[0];

  const body: Record<string, unknown> = {
    phone: d.phone,
    status: mapStatusToAPI(d.status),
    serviceType: d.serviceType,
    profile: {
      firstName,
      lastName,
      email: d.email || undefined,
      dateOfBirth,
      sex: mapSexToAPI(d.sex),
      height: d.heightCm,
      weight: d.weightKg,
      startWeight: d.startWeightKg,
      goalWeight: d.targetWeightKg,
      activityLevel: factorToLevel(d.activityFactor),
      goal: mapGoalToAPI(d.goalType),
      occupation: d.occupation || undefined,
      sleepHours: d.sleepHours,
      dietaryPreferences: d.dietaryPrefs,
      allergies: d.allergies,
    },
    clinical: {
      medicalHistory: d.medicalHistory,
    },
  };

  if (d.overrideTargets && d.targets) {
    body.targets = {
      method: "manual",
      calories: d.targets.calories,
      protein: d.targets.protein,
      carbs: d.targets.carbs,
      fat: d.targets.fat,
    };
  }

  return body;
}

// ── Exported query/mutation functions ──

interface ListResult {
  clients: APIClient[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchClients(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<{ clients: ClientRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  const q = qs.toString();
  const result = await api.get<ListResult>(`/api/clients${q ? `?${q}` : ""}`);
  return {
    clients: result.clients.map(toClientRecord),
    total: result.total,
  };
}

export async function fetchClient(id: string): Promise<ClientRecord> {
  const raw = await api.get<APIClient>(`/api/clients/${id}`);
  const record = toClientRecord(raw);
  const notes = await fetchClientNotes(id);
  record.adimeNotes = notes;
  return record;
}

export async function createClient(data: CreatePayload): Promise<ClientRecord> {
  const raw = await api.post<APIClient>("/api/clients", toAPIBody(data));
  return toClientRecord(raw);
}

export async function updateClient(
  id: string,
  data: Partial<CreatePayload>,
): Promise<ClientRecord> {
  const body: Record<string, unknown> = {};

  if (data.status) body.status = mapStatusToAPI(data.status);
  if (data.serviceType !== undefined) body.serviceType = data.serviceType;
  if (data.phone) body.phone = data.phone;

  const profile: Record<string, unknown> = {};
  if (data.name) {
    const parts = data.name.trim().split(/\s+/);
    profile.firstName = parts[0];
    profile.lastName = parts.slice(1).join(" ");
  }
  if (data.weightKg) profile.weight = data.weightKg;
  if (data.heightCm) profile.height = data.heightCm;
  if (Object.keys(profile).length) body.profile = profile;

  const raw = await api.patch<APIClient>(`/api/clients/${id}`, body);
  return toClientRecord(raw);
}

export async function fetchClientNotes(
  clientId: string,
): Promise<{ date: string; note: string }[]> {
  const notes = await api.get<APINote[]>(`/api/clients/${clientId}/notes`);
  return notes.map((n) => ({
    date: n.createdAt?.split("T")[0] || "",
    note: n.content,
  }));
}

export async function addClientNote(
  clientId: string,
  content: string,
): Promise<{ date: string; note: string }> {
  const n = await api.post<APINote>(`/api/clients/${clientId}/notes`, {
    content,
  });
  return { date: n.createdAt?.split("T")[0] || "", note: n.content };
}
