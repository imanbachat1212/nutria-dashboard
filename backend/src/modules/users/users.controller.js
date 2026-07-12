import { asyncHandler } from "../../lib/asyncHandler.js";
import * as usersService from "./users.service.js";

export const create = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.validated.body);
  res.status(201).json({ data: user });
});

export const list = asyncHandler(async (req, res) => {
  const result = await usersService.listUsers(req.validated.query);
  res.json({ data: result });
});

export const getOne = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(req.params.id);
  res.json({ data: user });
});

export const update = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(req.params.id, req.validated.body);
  res.json({ data: user });
});

export const remove = asyncHandler(async (req, res) => {
  await usersService.deleteUser(req.params.id);
  res.status(204).end();
});
