import { asyncHandler } from "../../lib/asyncHandler.js";
import * as service from "./recipe-import.service.js";

export const importRecipe = asyncHandler(async (req, res) => {
  const { url, rawText } = req.validated.body;
  const userId = req.user?._id;

  const data = url
    ? await service.importFromUrl({ url, userId })
    : await service.importFromText({ rawText, userId });

  res.json({ data });
});
