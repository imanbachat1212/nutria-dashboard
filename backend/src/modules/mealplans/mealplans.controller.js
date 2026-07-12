import { asyncHandler } from "../../lib/asyncHandler.js";
import * as svc from "./mealplans.service.js";

export const create = asyncHandler(async (req, res) => {
  const plan = await svc.createPlan(req.validated.body, req.user);
  res.status(201).json({ data: plan });
});

export const list = asyncHandler(async (req, res) => {
  const result = await svc.listPlans(req.validated.query);
  res.json({ data: result });
});

export const getOne = asyncHandler(async (req, res) => {
  const plan = await svc.getPlanById(req.params.id);
  res.json({ data: plan });
});

export const update = asyncHandler(async (req, res) => {
  const plan = await svc.updatePlan(req.params.id, req.validated.body);
  res.json({ data: plan });
});

export const duplicate = asyncHandler(async (req, res) => {
  const plan = await svc.duplicatePlan(req.params.id, req.validated.body, req.user);
  res.status(201).json({ data: plan });
});

export const copyDay = asyncHandler(async (req, res) => {
  const { fromDay, toDays } = req.validated.body;
  const plan = await svc.copyDay(req.params.id, fromDay, toDays);
  res.json({ data: plan });
});

export const pdfExport = asyncHandler(async (req, res) => {
  const { pdf, name } = await svc.exportPlanToPdf(req.params.id);
  const safe = name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "meal-plan";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}.pdf"`);
  res.send(Buffer.from(pdf));
});

export const remove = asyncHandler(async (req, res) => {
  await svc.deletePlan(req.params.id);
  res.status(204).end();
});

export const addItem = asyncHandler(async (req, res) => {
  const plan = await svc.addItem(req.params.id, req.validated.body);
  res.status(201).json({ data: plan });
});

export const removeItem = asyncHandler(async (req, res) => {
  await svc.removeItem(req.params.id, req.params.itemId);
  res.status(204).end();
});
