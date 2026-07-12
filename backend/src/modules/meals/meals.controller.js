import { asyncHandler } from "../../lib/asyncHandler.js";
import * as mealsService from "./meals.service.js";

export const create = asyncHandler(async (req, res) => {
  const meal = await mealsService.createMeal(req.validated.body, req.user);
  res.status(201).json({ data: meal });
});

export const list = asyncHandler(async (req, res) => {
  const result = await mealsService.listMeals(req.validated.query);
  res.json({ data: result });
});

export const getOne = asyncHandler(async (req, res) => {
  const meal = await mealsService.getMealById(req.params.id);
  res.json({ data: meal });
});

export const update = asyncHandler(async (req, res) => {
  const meal = await mealsService.updateMeal(req.params.id, req.validated.body);
  res.json({ data: meal });
});

export const remove = asyncHandler(async (req, res) => {
  await mealsService.deleteMeal(req.params.id);
  res.status(204).end();
});
