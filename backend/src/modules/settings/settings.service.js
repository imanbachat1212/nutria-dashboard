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
