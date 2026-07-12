import { asyncHandler } from "../../lib/asyncHandler.js";
import * as mediaService from "./media.service.js";

export const upload = asyncHandler(async (req, res) => {
  const result = await mediaService.uploadImage(req.file);
  res.status(201).json({ data: result });
});
