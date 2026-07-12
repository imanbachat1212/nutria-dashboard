import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import User from "../users/user.model.js";
import { ApiError } from "../../lib/ApiError.js";

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select("+password").populate("role", "name permissions");
  if (!user) throw new ApiError(401, "Invalid credentials");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new ApiError(401, "Invalid credentials");

  if (!user.active) throw new ApiError(403, "Account disabled");

  const token = jwt.sign({ sub: user._id, role: user.role?.name }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const { password: _, ...safe } = user.toObject();
  return { token, user: safe };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) throw new ApiError(400, "Current password is incorrect");

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
}

export async function getMe(userId) {
  const user = await User.findById(userId).populate("role", "name permissions").lean();
  if (!user) throw new ApiError(404, "User not found");
  return user;
}
