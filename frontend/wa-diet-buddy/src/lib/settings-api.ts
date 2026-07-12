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
