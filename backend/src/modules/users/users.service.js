import bcrypt from "bcryptjs";
import User from "./user.model.js";
import Role from "./role.model.js";
import { ApiError } from "../../lib/ApiError.js";

export async function createUser(data) {
  const role = await Role.findById(data.role);
  if (!role) throw new ApiError(400, "Invalid role");

  const exists = await User.findOne({ email: data.email });
  if (exists) throw new ApiError(409, "Email already in use");

  const hashed = await bcrypt.hash(data.password, 12);
  const user = await User.create({ ...data, password: hashed });

  const { password, ...safe } = user.toObject();
  return safe;
}

export async function listUsers({ page, limit }) {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find().populate("role", "name permissions").skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ]);
  return { users, total, page, limit };
}

export async function getUserById(id) {
  const user = await User.findById(id).populate("role", "name permissions").lean();
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

export async function updateUser(id, data) {
  if (data.role) {
    const role = await Role.findById(data.role);
    if (!role) throw new ApiError(400, "Invalid role");
  }

  const user = await User.findByIdAndUpdate(id, data, { new: true })
    .populate("role", "name permissions")
    .lean();
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

export async function deleteUser(id) {
  const user = await User.findByIdAndDelete(id);
  if (!user) throw new ApiError(404, "User not found");
}
