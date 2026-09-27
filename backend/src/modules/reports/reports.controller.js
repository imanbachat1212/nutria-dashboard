import { asyncHandler } from "../../lib/asyncHandler.js";
import * as reportsService from "./reports.service.js";

export const overview = asyncHandler(async (_req, res) => {
  const data = await reportsService.getOverview();
  res.json({ data });
});
