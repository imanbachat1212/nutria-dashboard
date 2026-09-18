import { asyncHandler } from "../../lib/asyncHandler.js";
import * as automationService from "./automation.service.js";

export const clientContext = asyncHandler(async (req, res) => {
  const data = await automationService.getClientContext({ phone: req.validated.query.phone });
  res.json({ data });
});

export const foodLookup = asyncHandler(async (req, res) => {
  const data = await automationService.lookupFoods(req.validated.query);
  res.json({ data });
});
