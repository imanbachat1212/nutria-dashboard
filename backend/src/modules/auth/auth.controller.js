import { asyncHandler } from "../../lib/asyncHandler.js";
import * as authService from "./auth.service.js";
import * as invitesService from "../users/invites.service.js";

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.validated.body);
  res.json({ data: result });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  res.json({ data: user });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.validated.body);
  res.json({ message: "Password changed" });
});

export const describeInvite = asyncHandler(async (req, res) => {
  res.json({ data: await invitesService.describeInvite(req.validated.params.token) });
});

export const acceptInvite = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await invitesService.acceptInvite(req.validated.body) });
});
