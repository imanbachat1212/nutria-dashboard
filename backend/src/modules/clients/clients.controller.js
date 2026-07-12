import { asyncHandler } from "../../lib/asyncHandler.js";
import * as clientsService from "./clients.service.js";
import { serializeClient } from "./client.serializer.js";

export const create = asyncHandler(async (req, res) => {
  const client = await clientsService.createClient(req.validated.body, req.user);
  res.status(201).json({ data: serializeClient(client, req.user.permissions) });
});

export const list = asyncHandler(async (req, res) => {
  const result = await clientsService.listClients(req.validated.query);
  result.clients = result.clients.map((c) => serializeClient(c, req.user.permissions));
  res.json({ data: result });
});

export const getOne = asyncHandler(async (req, res) => {
  const client = await clientsService.getClientById(req.params.id);
  res.json({ data: serializeClient(client, req.user.permissions) });
});

export const update = asyncHandler(async (req, res) => {
  const client = await clientsService.updateClient(req.params.id, req.validated.body, req.user);
  res.json({ data: serializeClient(client, req.user.permissions) });
});

export const remove = asyncHandler(async (req, res) => {
  await clientsService.deleteClient(req.params.id);
  res.status(204).end();
});

export const addNote = asyncHandler(async (req, res) => {
  const note = await clientsService.addNote(req.params.id, req.validated.body.content, req.user._id);
  res.status(201).json({ data: note });
});

export const listNotes = asyncHandler(async (req, res) => {
  const notes = await clientsService.listNotes(req.params.id);
  res.json({ data: notes });
});
