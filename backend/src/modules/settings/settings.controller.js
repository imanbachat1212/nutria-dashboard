import { asyncHandler } from "../../lib/asyncHandler.js";
import * as svc from "./settings.service.js";

export const getClassTypes = asyncHandler(async (req, res) => {
  const classTypes = await svc.getClassTypes();
  res.json({ data: { classTypes } });
});

export const updateClassTypes = asyncHandler(async (req, res) => {
  const classTypes = await svc.updateClassTypes(req.validated.body.classTypes);
  res.json({ data: { classTypes } });
});

export const getDietaryPreferences = asyncHandler(async (req, res) => {
  const dietaryPreferences = await svc.getDietaryPreferences();
  res.json({ data: { dietaryPreferences } });
});

export const updateDietaryPreferences = asyncHandler(async (req, res) => {
  const dietaryPreferences = await svc.updateDietaryPreferences(
    req.validated.body.dietaryPreferences
  );
  res.json({ data: { dietaryPreferences } });
});
