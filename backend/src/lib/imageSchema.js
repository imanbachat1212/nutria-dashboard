import mongoose from "mongoose";

export const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);
