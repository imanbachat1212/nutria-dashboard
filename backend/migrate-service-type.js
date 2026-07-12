import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import Client from "./src/modules/clients/client.model.js";

const VALID_TYPES = ["diet", "gym", "classes"];

function stringToArray(value) {
  return value
    .split("_")
    .map((part) => part.trim())
    .filter((part) => VALID_TYPES.includes(part));
}

async function migrate() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const docs = await db
    .collection("clients")
    .find({ serviceType: { $type: "string" } })
    .toArray();

  console.log(`Found ${docs.length} client(s) with legacy string serviceType`);

  for (const doc of docs) {
    const converted = stringToArray(doc.serviceType);
    await db
      .collection("clients")
      .updateOne({ _id: doc._id }, { $set: { serviceType: converted } });
    console.log(`  ${doc._id}: "${doc.serviceType}" -> [${converted.join(", ")}]`);
  }

  console.log("Migration complete");
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
