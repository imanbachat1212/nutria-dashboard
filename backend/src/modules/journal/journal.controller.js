import { asyncHandler } from "../../lib/asyncHandler.js";
import * as svc from "./journal.service.js";

export const create = asyncHandler(async (req, res) => {
  const entry = await svc.createEntry(req.validated.body, req.user);
  res.status(201).json({ data: entry });
});

export const list = asyncHandler(async (req, res) => {
  const entries = await svc.listEntries(req.validated.query);
  res.json({ data: entries });
});

export const getOne = asyncHandler(async (req, res) => {
  const entry = await svc.getEntryById(req.params.id);
  res.json({ data: entry });
});

export const update = asyncHandler(async (req, res) => {
  const entry = await svc.updateEntry(req.params.id, req.validated.body, req.user);
  res.json({ data: entry });
});

export const remove = asyncHandler(async (req, res) => {
  await svc.deleteEntry(req.params.id);
  res.status(204).end();
});
