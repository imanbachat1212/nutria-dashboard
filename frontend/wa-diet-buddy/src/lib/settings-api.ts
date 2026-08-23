import { api } from "./api";

export async function fetchClassTypes(): Promise<string[]> {
  const result = await api.get<{ classTypes: string[] }>("/api/settings/class-types");
  return result.classTypes;
}

export async function updateClassTypes(classTypes: string[]): Promise<string[]> {
  const result = await api.patch<{ classTypes: string[] }>("/api/settings/class-types", {
    classTypes,
  });
  return result.classTypes;
}

export async function fetchDietaryPreferences(): Promise<string[]> {
  const result = await api.get<{ dietaryPreferences: string[] }>(
    "/api/settings/dietary-preferences",
  );
  return result.dietaryPreferences;
}

export async function updateDietaryPreferences(dietaryPreferences: string[]): Promise<string[]> {
  const result = await api.patch<{ dietaryPreferences: string[] }>(
    "/api/settings/dietary-preferences",
    { dietaryPreferences },
  );
  return result.dietaryPreferences;
}

export async function fetchAllergies(): Promise<string[]> {
  const result = await api.get<{ allergies: string[] }>("/api/settings/allergies");
  return result.allergies;
}

export async function updateAllergies(allergies: string[]): Promise<string[]> {
  const result = await api.patch<{ allergies: string[] }>("/api/settings/allergies", {
    allergies,
  });
  return result.allergies;
}

export async function fetchMedicalHistory(): Promise<string[]> {
  const result = await api.get<{ medicalHistory: string[] }>("/api/settings/medical-history");
  return result.medicalHistory;
}

export async function updateMedicalHistory(medicalHistory: string[]): Promise<string[]> {
  const result = await api.patch<{ medicalHistory: string[] }>("/api/settings/medical-history", {
    medicalHistory,
  });
  return result.medicalHistory;
}
