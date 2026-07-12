import { asyncHandler } from "../../lib/asyncHandler.js";
import * as svc from "./cms.service.js";

export const create = asyncHandler(async (req, res) => {
  const page = await svc.createPage(req.validated.body, req.user);
  res.status(201).json({ data: page });
});

export const list = asyncHandler(async (req, res) => {
  const pages = await svc.listPages(req.validated.query);
  res.json({ data: pages });
});

export const getOne = asyncHandler(async (req, res) => {
  const page = await svc.getPage(req.params.id);
  res.json({ data: page });
});

export const update = asyncHandler(async (req, res) => {
  const page = await svc.updatePage(req.params.id, req.validated.body);
  res.json({ data: page });
});

export const publish = asyncHandler(async (req, res) => {
  const page = await svc.publishPage(req.params.id);
  res.json({ data: page });
});

export const unpublish = asyncHandler(async (req, res) => {
  const page = await svc.unpublishPage(req.params.id);
  res.json({ data: page });
});

export const schedule = asyncHandler(async (req, res) => {
  const page = await svc.schedulePage(req.params.id, req.validated.body.scheduledAt);
  res.json({ data: page });
});

export const remove = asyncHandler(async (req, res) => {
  await svc.deletePage(req.params.id);
  res.status(204).end();
});
