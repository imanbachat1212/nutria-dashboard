import { asyncHandler } from "../../lib/asyncHandler.js";
import * as svc from "./mealplantemplates.service.js";

export const list = asyncHandler(async (req, res) => {
  const templates = await svc.listTemplates(req.validated.query);
  res.json({ data: { templates } });
});

export const getOne = asyncHandler(async (req, res) => {
  const template = await svc.getTemplateById(req.params.id);
  res.json({ data: template });
});

export const create = asyncHandler(async (req, res) => {
  const template = await svc.createTemplate(req.validated.body, req.user);
  res.status(201).json({ data: template });
});

export const update = asyncHandler(async (req, res) => {
  const template = await svc.updateTemplate(req.params.id, req.validated.body);
  res.json({ data: template });
});

export const archive = asyncHandler(async (req, res) => {
  const template = await svc.setTemplateArchived(req.params.id, true);
  res.json({ data: template });
});

export const restore = asyncHandler(async (req, res) => {
  const template = await svc.setTemplateArchived(req.params.id, false);
  res.json({ data: template });
});

export const remove = asyncHandler(async (req, res) => {
  await svc.deleteTemplate(req.params.id);
  res.status(204).end();
});

export const addItem = asyncHandler(async (req, res) => {
  const template = await svc.addTemplateItem(req.params.id, req.validated.body);
  res.status(201).json({ data: template });
});

export const updateItem = asyncHandler(async (req, res) => {
  const template = await svc.updateTemplateItem(req.params.id, req.params.itemId, req.validated.body);
  res.json({ data: template });
});

export const removeItem = asyncHandler(async (req, res) => {
  const template = await svc.removeTemplateItem(req.params.id, req.params.itemId);
  res.json({ data: template });
});
