import { ApiError } from "../../lib/ApiError.js";

export function serializeClient(client, permissions) {
  if (!client) return client;
  const obj = typeof client.toObject === "function" ? client.toObject() : { ...client };

  if (!permissions.includes("*") && !permissions.includes("clients.clinical.read")) {
    delete obj.clinical;
  }
  return obj;
}

export function guardClinicalWrite(data, permissions) {
  if (!data?.clinical) return;
  if (permissions.includes("*") || permissions.includes("clients.clinical.write")) return;
  throw new ApiError(403, "Missing permission: clients.clinical.write");
}
