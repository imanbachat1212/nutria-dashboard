import Client from "./client.model.js";
import ClientNote from "./client-note.model.js";
import { normalizePhone } from "../../lib/phone.js";
import { ApiError } from "../../lib/ApiError.js";
import { guardClinicalWrite } from "./client.serializer.js";
import { deleteImage } from "../../lib/storage.js";
import { calcTargets, canComputeTargets, ageFromDOB } from "../../lib/calc/targets.js";

function computeTargetsIfEligible(profile, existingTargets) {
  if (existingTargets?.method === "manual") return existingTargets;
  if (!canComputeTargets(profile)) return existingTargets || null;

  const age = ageFromDOB(profile.dateOfBirth);
  if (!age || age <= 0) return existingTargets || null;

  return calcTargets({
    weight: profile.weight,
    height: profile.height,
    age,
    sex: profile.sex,
    activityLevel: profile.activityLevel,
    goal: profile.goal || "maintain",
  });
}

export async function createClient(data, actor) {
  guardClinicalWrite(data, actor.permissions);
  data.phone = normalizePhone(data.phone);

  const exists = await Client.findOne({ phone: data.phone });
  if (exists) throw new ApiError(409, "Client with this phone already exists");

  if (data.targets?.method === "manual") {
    // keep manual targets as provided
  } else {
    data.targets = computeTargetsIfEligible(data.profile, null);
  }

  return Client.create(data);
}

export async function listClients({ page, limit, status, search }) {
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { phone: { $regex: search, $options: "i" } },
      { "profile.firstName": { $regex: search, $options: "i" } },
      { "profile.lastName": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [clients, total] = await Promise.all([
    Client.find(filter).skip(skip).limit(limit).lean(),
    Client.countDocuments(filter),
  ]);
  return { clients, total, page, limit };
}

export async function getClientById(id) {
  const client = await Client.findById(id).lean();
  if (!client) throw new ApiError(404, "Client not found");
  return client;
}

export async function updateClient(id, data, actor) {
  guardClinicalWrite(data, actor.permissions);
  if (data.phone) data.phone = normalizePhone(data.phone);

  const existing = await Client.findById(id).lean();
  if (!existing) throw new ApiError(404, "Client not found");

  if (data.targets?.method === "manual") {
    // explicit manual override — use as-is
  } else if (data.profile) {
    const merged = { ...existing.profile, ...data.profile };
    data.targets = computeTargetsIfEligible(merged, existing.targets);
  }

  const client = await Client.findByIdAndUpdate(id, data, { new: true }).lean();
  return client;
}

export async function deleteClient(id) {
  const client = await Client.findByIdAndDelete(id);
  if (!client) throw new ApiError(404, "Client not found");
  if (client.photo?.key) deleteImage(client.photo.key).catch(() => {});
}

export async function addNote(clientId, content, authorId) {
  const client = await Client.findById(clientId);
  if (!client) throw new ApiError(404, "Client not found");
  return ClientNote.create({ client: clientId, author: authorId, content });
}

export async function listNotes(clientId) {
  return ClientNote.find({ client: clientId }).populate("author", "name").sort("-createdAt").lean();
}
