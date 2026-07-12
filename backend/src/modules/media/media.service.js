import { uploadImage } from "../../lib/storage.js";
import { ApiError } from "../../lib/ApiError.js";

export async function uploadImage_(file) {
  if (!file) throw new ApiError(400, "No image provided");
  return uploadImage(file.buffer, "nutri");
}

export { uploadImage_ as uploadImage };
