import { asyncHandler } from "../../lib/asyncHandler.js";
import * as foodsService from "./foods.service.js";

export const create = asyncHandler(async (req, res) => {
  const { food, unitWeightMatch } = await foodsService.createFood(req.validated.body, req.user);
  // unitWeightMatch nested inside `data` (not a sibling key) so the frontend's generic
  // json.data-unwrapping `api` client carries it through automatically. food.toObject() is
  // needed here (unlike update's already-.lean() result) since Food.create() returns a live
  // Mongoose document, whose own .toJSON() would silently drop an ad-hoc extra property.
  res.status(201).json({ data: { ...food.toObject(), unitWeightMatch } });
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
  const { food, unitWeightMatch } = await foodsService.updateFood(
    req.params.id,
    req.validated.body,
  );
  // food is already .lean() (plain object) here, so a direct spread is enough.
  res.json({ data: { ...food, unitWeightMatch } });
});

export const remove = asyncHandler(async (req, res) => {
  await foodsService.deleteFood(req.params.id);
  res.status(204).end();
});

export const usdaSearch = asyncHandler(async (req, res) => {
  const { q, limit } = req.validated.query;
  const results = await foodsService.searchUsda(q, limit);
  res.json({ data: { results } });
});

export const usdaImport = asyncHandler(async (req, res) => {
  const { food, created } = await foodsService.importUsdaFood(req.validated.body.fdcId, req.user);
  res.status(created ? 201 : 200).json({ data: food });
});

export const usdaImported = asyncHandler(async (req, res) => {
  const fdcIds = req.validated.query.fdcIds
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  const importedFdcIds = await foodsService.getImportedUsdaFdcIds(fdcIds);
  res.json({ data: { fdcIds: importedFdcIds } });
});
