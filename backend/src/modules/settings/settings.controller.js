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

export const getAllergies = asyncHandler(async (req, res) => {
  const allergies = await svc.getAllergies();
  res.json({ data: { allergies } });
});

export const updateAllergies = asyncHandler(async (req, res) => {
  const allergies = await svc.updateAllergies(req.validated.body.allergies);
  res.json({ data: { allergies } });
});

export const getMedicalHistory = asyncHandler(async (req, res) => {
  const medicalHistory = await svc.getMedicalHistory();
  res.json({ data: { medicalHistory } });
});

export const updateMedicalHistory = asyncHandler(async (req, res) => {
  const medicalHistory = await svc.updateMedicalHistory(req.validated.body.medicalHistory);
  res.json({ data: { medicalHistory } });
});
