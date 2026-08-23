import Setting from "./setting.model.js";

// Generic key/value Setting doc, scoped to one key for now. Group class types used to be a
// hardcoded CLASS_TYPES array in appointments.validation.js — moved here so Settings → Services
// is the single source of truth and appointments.service.js validates against it at write time.
const CLASS_TYPES_KEY = "gymClassTypes";
const DEFAULT_CLASS_TYPES = ["Pilates", "Zumba", "Yoga"];

export async function getClassTypes() {
  const setting = await Setting.findOne({ key: CLASS_TYPES_KEY }).lean();
  return setting?.value?.length ? setting.value : DEFAULT_CLASS_TYPES;
}

export async function updateClassTypes(classTypes) {
  const setting = await Setting.findOneAndUpdate(
    { key: CLASS_TYPES_KEY },
    {
      key: CLASS_TYPES_KEY,
      value: classTypes,
      description: "Group class types offered — populates the Group class name dropdown in the New Appointment dialog.",
    },
    { upsert: true, new: true }
  ).lean();
  return setting.value;
}

// Same generic Setting-doc pattern as gymClassTypes above — Settings → Services is the single
// source of truth. This one list is shared by every diet/preference picker in the app: the New
// Client dialog's Dietary preferences multi-select, the Meal Library "Diet & tags" filter, and
// the New Recipe dialog's diet-tag picker. A separate "mealDietTags" list briefly existed for
// the latter two but was merged back in here — one editable list, one Settings card.
const DIETARY_PREFERENCES_KEY = "dietaryPreferences";
const DEFAULT_DIETARY_PREFERENCES = [
  "Mediterranean",
  "Vegetarian-leaning",
  "High protein",
  "Low carb",
  "Vegan",
  "Gluten-free",
  "Dairy-free",
  "Pescatarian",
  "Keto",
  "PCOS-friendly",
  "Ramadan",
];

export async function getDietaryPreferences() {
  const setting = await Setting.findOne({ key: DIETARY_PREFERENCES_KEY }).lean();
  return setting?.value?.length ? setting.value : DEFAULT_DIETARY_PREFERENCES;
}

export async function updateDietaryPreferences(dietaryPreferences) {
  const setting = await Setting.findOneAndUpdate(
    { key: DIETARY_PREFERENCES_KEY },
    {
      key: DIETARY_PREFERENCES_KEY,
      value: dietaryPreferences,
      description: "Dietary preference options — populates the Dietary preferences multi-select in the New Client dialog, the Meal Library Diet & tags filter, and the New Recipe dialog's diet-tag picker.",
    },
    { upsert: true, new: true }
  ).lean();
  return setting.value;
}

// Same generic Setting-doc pattern as above — populates the Allergies pill multi-select in the
// New Client dialog. A dietitian can still add a one-off allergy specific to a single client
// without touching this shared list (see new-client-dialog.tsx's "Other" entry) — this list is
// only the predefined/common options offered up front.
const ALLERGIES_KEY = "allergies";
const DEFAULT_ALLERGIES = [
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Fish",
  "Dairy",
  "Eggs",
  "Gluten/Wheat",
  "Soy",
  "Sesame",
];

export async function getAllergies() {
  const setting = await Setting.findOne({ key: ALLERGIES_KEY }).lean();
  return setting?.value?.length ? setting.value : DEFAULT_ALLERGIES;
}

export async function updateAllergies(allergies) {
  const setting = await Setting.findOneAndUpdate(
    { key: ALLERGIES_KEY },
    {
      key: ALLERGIES_KEY,
      value: allergies,
      description: "Common allergy options — populates the Allergies pill multi-select in the New Client dialog.",
    },
    { upsert: true, new: true }
  ).lean();
  return setting.value;
}

// Same pattern again — populates the Medical history pill multi-select in the New Client
// dialog. Note: unlike allergies (in the ungated `profile` block), a client's actual
// medicalHistory values live in the permission-gated `clinical` block (clients.clinical.read/
// write) — this shared OPTIONS list itself is not clinical data and isn't gated the same way.
const MEDICAL_HISTORY_KEY = "medicalHistory";
const DEFAULT_MEDICAL_HISTORY = [
  "PCOS",
  "Hypothyroidism",
  "Hyperthyroidism",
  "Hypertension",
  "Type 2 Diabetes",
  "Type 1 Diabetes",
  "High cholesterol",
  "IBS",
  "Celiac disease",
  "Anemia",
];

export async function getMedicalHistory() {
  const setting = await Setting.findOne({ key: MEDICAL_HISTORY_KEY }).lean();
  return setting?.value?.length ? setting.value : DEFAULT_MEDICAL_HISTORY;
}

export async function updateMedicalHistory(medicalHistory) {
  const setting = await Setting.findOneAndUpdate(
    { key: MEDICAL_HISTORY_KEY },
    {
      key: MEDICAL_HISTORY_KEY,
      value: medicalHistory,
      description: "Common medical history options — populates the Medical history pill multi-select in the New Client dialog.",
    },
    { upsert: true, new: true }
  ).lean();
  return setting.value;
}
