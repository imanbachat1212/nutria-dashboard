import { asyncHandler } from "../../lib/asyncHandler.js";
import * as auditService from "./audit.service.js";

export const list = asyncHandler(async (req, res) => {
  res.json({ data: await auditService.listAuditLog(req.validated.query) });
});

export const facets = asyncHandler(async (_req, res) => {
  res.json({ data: await auditService.auditFacets() });
});
