import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../lib/ApiError.js";
import User from "../modules/users/user.model.js";

// Service keys, most-privileged first. Each one authenticates as a machine identity with a
// FIXED permission list — the key itself decides the scope, so an outside tool can only ever do
// what the key it was given allows (prompt-91).
//
// SERVICE_API_KEY keeps its historical ["*"] so nothing that already uses it breaks. That key
// can do anything to anything and should stay internal. INTAKE_API_KEY exists precisely so the
// n8n WhatsApp flow never needs it: it carries one permission, "journal.intake", which gates
// exactly one route (POST /api/webhooks/whatsapp/journal) and nothing else in the app.
//
// Deliberately NOT "journal.create": that permission also opens POST /api/journal, where a
// caller chooses its own `source` and `status` and could insert pre-approved entries. The
// intake key should only be able to put things INTO the review queue, never past it.
function serviceKeyIdentity(apiKey) {
  // Guard on the configured value being non-empty, not just on equality — INTAKE_API_KEY
  // defaults to "", and an unset key must not be matchable by an empty header.
  if (env.SERVICE_API_KEY && apiKey === env.SERVICE_API_KEY) {
    return { _id: null, role: "automation", permissions: ["*"] };
  }
  if (env.INTAKE_API_KEY && apiKey === env.INTAKE_API_KEY) {
    return {
      _id: null,
      role: "automation-intake",
      // Two narrow permissions, not one broad one (prompt-94). journal.intake is the write
      // scope: file an inbound WhatsApp message as a pending entry. automation.context.read is
      // the read scope: this client's targets, what they've eaten today, today's plan, and a
      // food lookup — everything the coach needs to answer "how much do I have left?".
      //
      // Kept separate so either half can be revoked without the other, and neither is a
      // general-purpose permission: "foods.read" was rejected for the food lookup because it
      // would also open the USDA proxy routes (which spend the practice's FDC quota) and a full
      // dump of the library; "journal.create" was rejected earlier for the same kind of reason.
      // automation.messages.write (prompt-96) logs inbound/outbound messages to the inbox —
      // separate again, because a key that can file a meal should not implicitly be able to
      // write into the dietitian's conversation history.
      permissions: ["journal.intake", "automation.context.read", "automation.messages.write"],
    };
  }
  return null;
}

export function authenticate(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    const identity = serviceKeyIdentity(apiKey);
    if (!identity) {
      throw new ApiError(401, "Invalid API key");
    }
    req.user = identity;
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
