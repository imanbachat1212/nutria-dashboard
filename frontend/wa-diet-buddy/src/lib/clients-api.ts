import { api } from "./api";
import type {
  ClientRecord,
  ClientMacros,
  ServiceType,
  ClientStatus,
  ClientGoal,
  LifeStage,
  DriTargets,
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

// Defensive normalization for allergies/medicalHistory. The Mongoose schema declares both as
// [String] and every write path through this app's own dialog has always saved them properly
// split — but Mongoose only enforces shape on writes made through it, not on documents written
// some other way (a manual DB edit, an import script, a pre-dialog seed). A value written
// outside Mongoose could be a plain string, or an array with one giant unsplit comma/newline
// string in it. Splitting every element through the same comma/newline logic the dialog used to
// use for its textareas handles a clean array (no-op, nothing to split), a legacy plain string
// (wrapped then split), and a malformed one-element array uniformly, with no separate
// special-casing needed. Also case-insensitively dedupes, since a value split out of two
// different messy sources could otherwise repeat.
function normalizeStringList(value: string[] | string | undefined | null): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    for (const piece of String(entry).split(/[,\n]+/)) {
      const trimmed = piece.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

// ── API → ClientRecord ──

interface APIClient {
  _id: string;
  phone: string;
  status: string;
  archived?: boolean;
  serviceType: string[];
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: string;
    sex?: string;
    lifeStage?: string;
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
  driTargets?: DriTargets;
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
    archived: c.archived ?? false,
    joinedAt: c.createdAt?.split("T")[0] || "",
    age: ageFromDOB(p.dateOfBirth),
    dateOfBirth: p.dateOfBirth,
    sex: mapSexFromAPI(p.sex),
    lifeStage: (p.lifeStage as LifeStage | undefined) || "none",
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
    driTargets: c.driTargets,
    occupation: p.occupation || "—",
    sleepHours: p.sleepHours || 0,
    dietaryPrefs: p.dietaryPreferences || [],
    allergies: normalizeStringList(p.allergies),
    medicalHistory: normalizeStringList(cl?.medicalHistory),
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

export interface CreatePayload {
  name: string;
  phone: string;
  email?: string;
  serviceType: ServiceType[];
  status: ClientStatus;
  age: number;
  sex: "F" | "M";
  lifeStage: LifeStage;
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
  // Edit mode only: the client's age and raw dateOfBirth exactly as loaded, before any edits
  // in this session. When both are present and `age` still matches `originalAge` at save time,
  // `originalDateOfBirth` is sent back unchanged instead of a fresh value being computed from
  // age — see the dateOfBirth logic in toAPIBody below for why. Left undefined for create,
  // where there's no "original" to compare against and computing from the entered age is
  // simply correct.
  originalAge?: number;
  originalDateOfBirth?: string;
}

function toAPIBody(d: CreatePayload) {
  const nameParts = d.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // The dialog only collects age, not a real birthdate, so a create has to compute one —
  // "today minus age years" is as good a guess as any. But on an EDIT, recomputing this on
  // every save (regardless of what actually changed) would silently drift a client's stored
  // day/month to today's, forever, every time an unrelated field is saved. If age hasn't
  // changed since this record was loaded, send the exact original value straight back instead
  // — the backend's update replaces the whole `profile` subdocument wholesale (see
  // clients.service.js's updateClient), so this has to be a real value, not just omitted, or
  // it would be wiped rather than preserved.
  const dateOfBirth =
    d.originalDateOfBirth != null && d.originalAge === d.age
      ? d.originalDateOfBirth
      : (() => {
          const dob = new Date();
          dob.setFullYear(dob.getFullYear() - d.age);
          return dob.toISOString().split("T")[0];
        })();

  const body: Record<string, unknown> = {
    phone: d.phone,
    status: mapStatusToAPI(d.status),
    serviceType: d.serviceType,
    profile: {
      firstName,
      // A single-word name (e.g. "Cher", a business name) leaves lastName empty — omit it
      // rather than send "" here. The backend's lastName field is z.string().min(1).optional(),
      // which allows the key to be absent but rejects a present-but-empty string, so sending ""
      // caused single-word names to fail validation entirely.
      lastName: lastName || undefined,
      email: d.email || undefined,
      dateOfBirth,
      sex: mapSexToAPI(d.sex),
      // Only meaningful when sex is female — sent regardless since the backend defaults it to
      // "none" and getDriTargets() only consults it when sex === "female" anyway.
      lifeStage: d.lifeStage,
      height: d.heightCm,
      weight: d.weightKg,
      startWeight: d.startWeightKg,
      goalWeight: d.targetWeightKg,
      activityLevel: factorToLevel(d.activityFactor),
      goal: mapGoalToAPI(d.goalType),
      // `d.occupation` is already the raw form value here, never the "—" placeholder
      // toClientRecord substitutes for display purposes — so an empty occupation correctly
      // omits the key rather than round-tripping the literal placeholder string into storage.
      occupation: d.occupation.trim() || undefined,
      sleepHours: d.sleepHours,
      dietaryPreferences: d.dietaryPrefs,
      allergies: d.allergies,
    },
  };

  // Omitted entirely (not sent as `{ medicalHistory: [] }`) when there's nothing to write —
  // the backend's guardClinicalWrite rejects ANY request carrying a `clinical` key from a user
  // without clients.clinical.write, so an always-present-but-empty object would block an
  // assistant-role dietitian from creating/editing a client at all, even one with no medical
  // history recorded. It also means an assistant's edit never risks clobbering a client's real
  // (hidden-from-them, since the GET response already strips `clinical` for their role) medical
  // history with the blank list they see.
  //
  // Known tradeoff: since an empty list is indistinguishable here from "don't touch clinical
  // data", a dietitian who DOES have clinical.write and wants to explicitly clear an existing
  // client's medical history to blank via this dialog won't have that clearing persist — the
  // key gets omitted and the old value survives untouched. Fixing that properly needs the
  // dialog to know the current user's permissions (to tell "never had any" apart from "clinical
  // data exists but I can't see/shouldn't touch it" apart from "I can see it and I'm clearing
  // it"), which is out of scope here — flagged as a follow-up, not fixed.
  if (d.medicalHistory.length > 0) {
    body.clinical = { medicalHistory: d.medicalHistory };
  }

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
  serviceType?: ServiceType;
  search?: string;
  archived?: boolean;
  sort?: "newest" | "name";
}): Promise<{ clients: ClientRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.status) qs.set("status", params.status);
  if (params?.serviceType) qs.set("serviceType", params.serviceType);
  if (params?.search) qs.set("search", params.search);
  if (params?.archived) qs.set("archived", "true");
  if (params?.sort) qs.set("sort", params.sort);
  const q = qs.toString();
  const result = await api.get<ListResult>(`/api/clients${q ? `?${q}` : ""}`);
  return {
    clients: result.clients.map(toClientRecord),
    total: result.total,
  };
}

// True counts for the mini-stat strip — always the active (non-archived) roster, independent
// of the table's current search/filter, matching foods' getFoodsStats pattern (a dedicated
// backend aggregate rather than deriving from a page-capped array).
export interface ClientStats {
  total: number;
  active: number;
  diet: number;
  gym: number;
  classes: number;
}

export async function fetchClientStats(): Promise<ClientStats> {
  return api.get<ClientStats>("/api/clients/stats");
}

// "Delete" in the UI — archives (soft-deletes) a client rather than erasing them. Every
// referenced record (plans, appointments, billing, journal, notes) is left untouched.
export async function archiveClient(id: string): Promise<ClientRecord> {
  const raw = await api.post<APIClient>(`/api/clients/${id}/archive`, {});
  return toClientRecord(raw);
}

export async function restoreClient(id: string): Promise<ClientRecord> {
  const raw = await api.post<APIClient>(`/api/clients/${id}/restore`, {});
  return toClientRecord(raw);
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

// Full-record save, same shape as createClient — the edit dialog always submits the complete
// form state (all 4 steps), not a sparse patch, so this reuses toAPIBody exactly rather than
// maintaining a second, independently-drifting field list. (The previous version of this
// function only ever sent status/serviceType/phone/name/weight/height — silently dropping
// email, age, sex, lifeStage, startWeight, goalWeight, activityLevel, goal, occupation,
// sleepHours, dietary preferences, allergies, medical history, and targets on every "edit".
// It had no callers yet, so nothing depended on the old partial behavior.) `archived` is
// deliberately not a field here at all — it's only ever set via archiveClient/restoreClient.
export async function updateClient(id: string, data: CreatePayload): Promise<ClientRecord> {
  const raw = await api.patch<APIClient>(`/api/clients/${id}`, toAPIBody(data));
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
