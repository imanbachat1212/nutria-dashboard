import { asyncHandler } from "../../lib/asyncHandler.js";
import * as foodsService from "./foods.service.js";

export const create = asyncHandler(async (req, res) => {
  const food = await foodsService.createFood(req.validated.body, req.user);
  res.status(201).json({ data: food });
});

export const list = asyncHandler(async (req, res) => {
  const result = await foodsService.listFoods(req.validated.query);
  res.json({ data: result });
});

export const getOne = asyncHandler(async (req, res) => {
  const food = await foodsService.getFoodById(req.params.id);
  res.json({ data: food });
});

export const update = asyncHandler(async (req, res) => {
  const food = await foodsService.updateFood(req.params.id, req.validated.body);
  res.json({ data: food });
});

export const remove = asyncHandler(async (req, res) => {
  await foodsService.deleteFood(req.params.id);
  res.status(204).end();
});

export const usdaSearch = asyncHandler(async (req, res) => {
  const results = await foodsService.searchUsda(req.validated.query.q);
  res.json({ data: { results } });
});

export const usdaImport = asyncHandler(async (req, res) => {
  const { food, created } = await foodsService.importUsdaFood(req.validated.body.fdcId, req.user);
  res.status(created ? 201 : 200).json({ data: food });
});
