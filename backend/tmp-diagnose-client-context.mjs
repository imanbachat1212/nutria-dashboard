import { connectDB } from "./src/config/db.js";
import Client from "./src/modules/clients/client.model.js";
import { normalizePhone } from "./src/lib/phone.js";
import { getClientContext } from "./src/modules/automation/automation.service.js";
import mongoose from "mongoose";

const RAW_PHONE = "+96170256769";

async function main() {
  await connectDB();

  const phone = normalizePhone(RAW_PHONE);
  console.log("normalizePhone(", JSON.stringify(RAW_PHONE), ") =>", JSON.stringify(phone));

  const client = await Client.findOne({ phone }).lean();
  if (!client) {
    console.log("Client.findOne({ phone }) => NULL (no client with this exact phone value)");
  } else {
    console.log("Client.findOne({ phone }) => FOUND:", JSON.stringify({
      id: String(client._id),
      storedPhone: client.phone,
      status: client.status,
      archived: client.archived,
      aiAutopilot: client.aiAutopilot,
      firstName: client.profile?.firstName,
      lastName: client.profile?.lastName,
    }, null, 2));
  }

  console.log("\n--- calling getClientContext({ phone }) directly, same as the live GET route ---");
  try {
    const ctx = await getClientContext({ phone: RAW_PHONE });
    console.log("SUCCESS. client:", JSON.stringify(ctx.client, null, 2));
  } catch (err) {
    console.log("THREW:", err.name, "| status:", err.statusCode ?? err.status ?? "n/a");
    console.log("message:", err.message);
    console.log("details:", JSON.stringify(err.details ?? err.data ?? null, null, 2));
    if (!err.statusCode && !err.status) {
      console.log("stack (first 15 lines):");
      console.log((err.stack || "").split("\n").slice(0, 15).join("\n"));
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
