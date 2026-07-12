import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../lib/ApiError.js";
import User from "../modules/users/user.model.js";

export function authenticate(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    if (apiKey !== env.SERVICE_API_KEY) {
      throw new ApiError(401, "Invalid API key");
    }
    req.user = { _id: null, role: "automation", permissions: ["*"] };
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or malformed token");
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  User.findById(payload.sub)
    .populate("role")
    .lean()
    .then((user) => {
      if (!user) throw new ApiError(401, "User not found");
      req.user = {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role?.name,
        permissions: user.role?.permissions || [],
      };
      next();
    })
    .catch(next);
}
