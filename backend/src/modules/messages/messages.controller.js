import { asyncHandler } from "../../lib/asyncHandler.js";
import * as messagesService from "./messages.service.js";

export const logMessage = asyncHandler(async (req, res) => {
  const data = await messagesService.logMessage(req.validated.body);
  res.status(201).json({ data });
});

export const listConversations = asyncHandler(async (_req, res) => {
  res.json({ data: await messagesService.listConversations() });
});

export const getThread = asyncHandler(async (req, res) => {
  const data = await messagesService.getThread(req.validated.params.clientId, req.validated.query);
  res.json({ data });
});

export const getStatus = asyncHandler(async (_req, res) => {
  res.json({ data: await messagesService.getStatus() });
});

export const send = asyncHandler(async (req, res) => {
  const data = await messagesService.sendMessage(
    { clientId: req.validated.body.client, body: req.validated.body.body },
    req.user,
  );
  res.status(201).json({ data });
});
