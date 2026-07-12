import { ApiError } from "../lib/ApiError.js";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
