import Message from "./message.model.js";
import Client from "../clients/client.model.js";
import { normalizePhone } from "../../lib/phone.js";
import { sendWhatsAppViaN8n, isOutboundConfigured } from "../../lib/n8n.js";
import { uploadImage } from "../../lib/storage.js";
import { ApiError } from "../../lib/ApiError.js";

// How recently a message must have arrived for the inbox to call the pipe "connected".
const CONNECTED_WINDOW_MS = 30 * 60 * 1000;

// Who actually wrote a message, derived rather than stored: direction and source already carry
// it, and a separate `author` column could disagree with them.
function authorOf(m) {
  if (m.direction === "inbound") return "contact";
  return m.source === "automation" ? "ai" : "dietitian";
}

function initialsOf(name) {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function clientName(client) {
  const p = client.profile || {};
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown";
}

function serialize(m) {
  return {
    id: String(m._id),
    direction: m.direction === "inbound" ? "in" : "out",
    author: authorOf(m),
    kind: m.kind || "text",
    text: m.body || "",
    at: m.sentAt,
    attachmentLabel: m.attachmentLabel ?? null,
    // The renderable image, flattened to just its URL (prompt-123). The inbox needs somewhere to
    // point an <img>; it has no use for the storage key, and the key is the handle used to DELETE
    // the object, so it stays server-side rather than being published to every reader of a thread.
    attachmentUrl: m.attachment?.url ?? null,
    status: m.status ?? null,
    error: m.error ?? null,
  };
}

// Phone -> client, using the SAME normalizePhone the journal intake uses. One implementation:
// two copies that drift is how a client's messages end up in someone else's inbox.
async function resolveClientByPhone(rawPhone) {
  const phone = normalizePhone(rawPhone);
  const client = phone ? await Client.findOne({ phone }).lean() : null;
  if (!client) {
    throw new ApiError(404, `No client matches the WhatsApp number ${phone ?? rawPhone}`, {
      code: "client_not_found",
      normalizedPhone: phone,
      receivedPhone: rawPhone,
    });
  }
  return client;
}

// ── Automation-facing ───────────────────────────────────────────────────────

// Decoded ceiling for an inbound photo. A phone camera JPEG is ~1-5 MB, so this leaves real
// headroom while still bounding what one message can put in storage. Checked on the DECODED
// length, not the base64 string, because the decoded size is what gets stored and what the
// dashboard later downloads.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// base64 -> Buffer, with the two things that actually go wrong in practice.
//
// `Buffer.from(s, "base64")` never throws: it skips characters outside the alphabet and returns
// whatever it managed to decode, so garbage silently becomes a short buffer. Both failures are
// turned into a 400 here rather than being uploaded as a corrupt object.
function decodeImage(imageBase64) {
  // An n8n expression forwarding a value from a browser or another API may hand over a full data
  // URL. Tolerated rather than rejected — the payload after the comma is exactly what we want.
  const raw = String(imageBase64).replace(/^data:[^;,]*;base64,/, "").trim();
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) {
    throw new ApiError(400, "imageBase64 did not decode to any image data", {
      code: "image_decode_failed",
    });
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ApiError(
      400,
      `Image is ${(buffer.length / 1048576).toFixed(1)} MB decoded; the limit is ${MAX_IMAGE_BYTES / 1048576} MB`,
      { code: "image_too_large", bytes: buffer.length, limit: MAX_IMAGE_BYTES },
    );
  }
  return buffer;
}

export async function logMessage(data) {
  const client = await resolveClientByPhone(data.phone);

  // Decode and size-check BEFORE anything is written. A malformed or oversized image is a bad
  // request about the whole call, so it 400s without leaving a half-logged message behind. The
  // mime whitelist is enforced one layer up, by logMessageSchema's enum.
  const buffer = data.imageBase64 ? decodeImage(data.imageBase64) : null;

  const msg = await Message.create({
    client: client._id,
    direction: data.direction,
    channel: data.channel ?? "whatsapp",
    body: data.body ?? "",
    kind: data.kind ?? "text",
    attachmentLabel: data.attachmentLabel ?? null,
    // An inbound message came from the client over WhatsApp; an outbound one logged through this
    // endpoint was written by the AI, since anything the dietitian sends goes through the
    // dashboard route below and is tagged "dashboard" there.
    source: data.direction === "inbound" ? "whatsapp" : "automation",
    // Inbound messages have no delivery state — they arrived. Outbound ones logged here were
    // already sent by n8n before it told us about them.
    status: data.direction === "inbound" ? null : "sent",
    sentAt: data.sentAt ? new Date(data.sentAt) : new Date(),
  });

  // The upload happens AFTER the message row exists, and that ordering is the whole point: the
  // text is already safe before anything touches the network. R2 being down, slow or
  // misconfigured then costs the photo and nothing else — the same reasoning sendMessage() below
  // uses for a failed n8n delivery, and the reason this isn't an upload-then-create.
  //
  // It also can't orphan an object: nothing is in storage until a row exists to point at it.
  let attachmentError = null;
  if (buffer) {
    try {
      const uploaded = await uploadImage(buffer, "messages");
      msg.attachment = uploaded;
      await msg.save();
    } catch (err) {
      // Logged, never thrown. `attachment` stays null, so the inbox falls back to the same
      // placeholder it shows for an older message, and the client's words still arrive.
      //
      // Deliberately NOT written to the document's `error` field: that field is documented and
      // rendered as OUTBOUND DELIVERY state, and an inbound message carrying one would make the
      // thread claim the message failed to send when it arrived perfectly well. The caller is
      // told through the response instead.
      console.error(`[messages] photo upload failed for message ${msg._id}:`, err.message);
      attachmentError = err.message;
    }
  }

  return {
    ...serialize(msg.toObject()),
    clientId: String(client._id),
    clientName: clientName(client),
    // Present only when an image was sent AND failed — so n8n can retry or alert, while still
    // seeing a 201 for the message it successfully logged.
    ...(attachmentError ? { attachmentError } : {}),
  };
}

// ── Dashboard-facing ────────────────────────────────────────────────────────

// One row per client that has ever exchanged a message. Built with an aggregation rather than
// N queries: the inbox opens on every page visit and the message collection only grows.
export async function listConversations() {
  const rows = await Message.aggregate([
    { $sort: { sentAt: -1 } },
    {
      $group: {
        _id: "$client",
        lastAt: { $first: "$sentAt" },
        lastBody: { $first: "$body" },
        lastKind: { $first: "$kind" },
        // $sort above is sentAt DESC, so $first is the NEWEST message in the group — the same
        // one lastBody/lastKind describe. Carried so the conversation row can show a thumbnail
        // next to its snippet without the list having to open every thread to find out.
        lastAttachment: { $first: "$attachment" },
        lastDirection: { $first: "$direction" },
        total: { $sum: 1 },
        // Inbound messages newer than the newest outbound one — see the `unread` note below.
        lastOutboundAt: {
          $max: { $cond: [{ $eq: ["$direction", "outbound"] }, "$sentAt", null] },
        },
        inbound: {
          $push: { $cond: [{ $eq: ["$direction", "inbound"] }, "$sentAt", "$$REMOVE"] },
        },
      },
    },
    { $sort: { lastAt: -1 } },
  ]);

  const clients = await Client.find({ _id: { $in: rows.map((r) => r._id) } })
    .select("profile.firstName profile.lastName phone status serviceType aiAutopilot archived")
    .lean();
  const byId = new Map(clients.map((c) => [String(c._id), c]));

  return rows
    .map((r) => {
      const client = byId.get(String(r._id));
      // A deleted client leaves its messages behind. Dropping the row is right — there is no
      // one to reply to — but it must not throw.
      if (!client) return null;

      const name = clientName(client);
      // `unread` here means "inbound messages that arrived after the last thing anyone sent
      // back" — i.e. awaiting a reply. It is NOT read-receipt tracking: that needs a per-thread
      // lastReadAt the dashboard writes when a thread is opened, which is a mark-read endpoint
      // this version doesn't have. The upgrade is additive whenever it's wanted.
      const unread = r.inbound.filter((t) => !r.lastOutboundAt || t > r.lastOutboundAt).length;
      const autopilot = client.aiAutopilot !== false;

      return {
        id: String(client._id),
        kind: client.status === "lead" ? "lead" : "client",
        contactId: String(client._id),
        name,
        phone: client.phone,
        avatarInitials: initialsOf(name),
        tag: client.status === "lead" ? "Lead" : (client.serviceType?.[0] ?? null),
        lastSnippet: r.lastBody || (r.lastKind === "image" ? "📷 Photo" : r.lastKind === "voice" ? "🎤 Voice note" : ""),
        // Same flattening as serialize() — URL only, key withheld. null for every conversation
        // whose newest message has no image, which is nearly all of them.
        attachmentUrl: r.lastAttachment?.url ?? null,
        lastAtIso: r.lastAt,
        unread,
        aiAutopilot: autopilot,
        // Something is waiting on a human specifically when the AI isn't handling this thread.
        awaitingDietitian: unread > 0 && !autopilot,
        messageCount: r.total,
      };
    })
    .filter(Boolean);
}

export async function getThread(clientId, { limit = 200 } = {}) {
  const client = await Client.findById(clientId)
    .select("profile.firstName profile.lastName phone status serviceType aiAutopilot")
    .lean();
  if (!client) throw new ApiError(404, "Client not found");

  const messages = await Message.find({ client: clientId }).sort({ sentAt: 1 }).limit(limit).lean();
  const name = clientName(client);
  return {
    id: String(client._id),
    kind: client.status === "lead" ? "lead" : "client",
    contactId: String(client._id),
    name,
    phone: client.phone,
    avatarInitials: initialsOf(name),
    tag: client.status === "lead" ? "Lead" : (client.serviceType?.[0] ?? null),
    aiAutopilot: client.aiAutopilot !== false,
    messages: messages.map(serialize),
  };
}

// Whether the WhatsApp pipe looks alive, for the inbox's status badge — replacing a hardcoded
// "n8n connected" string with something that can actually say "no". Deliberately weak by
// design: it reports "a message moved recently", not "n8n is healthy", and the response says so.
export async function getStatus() {
  const last = await Message.findOne().sort({ sentAt: -1 }).select("sentAt").lean();
  const lastAt = last?.sentAt ?? null;
  return {
    lastMessageAt: lastAt,
    recentlyActive: !!lastAt && Date.now() - new Date(lastAt).getTime() < CONNECTED_WINDOW_MS,
    windowMinutes: CONNECTED_WINDOW_MS / 60000,
    outboundConfigured: isOutboundConfigured(),
  };
}

// Dietitian pressing send. Writes the message first, then asks n8n to deliver it.
//
// Order matters: writing first means a failed send is visible in the thread as a failed message
// rather than vanishing along with what she typed. The endpoint still reports the failure, so
// the UI can say so — it just doesn't lose the text to do it.
export async function sendMessage({ clientId, body }, actor) {
  const client = await Client.findById(clientId).select("phone").lean();
  if (!client) throw new ApiError(404, "Client not found");

  const msg = await Message.create({
    client: client._id,
    direction: "outbound",
    channel: "whatsapp",
    body,
    kind: "text",
    source: "dashboard",
    status: "queued",
    sentAt: new Date(),
  });

  try {
    await sendWhatsAppViaN8n({ phone: client.phone, message: body });
    msg.status = "sent";
    await msg.save();
    return { message: serialize(msg.toObject()), delivered: true, error: null };
  } catch (err) {
    msg.status = "failed";
    msg.error = err.message;
    await msg.save();
    // 200, not a rethrow: the message exists and the caller needs to render it as failed. An
    // error status here would tell the UI "nothing happened", which isn't true.
    return { message: serialize(msg.toObject()), delivered: false, error: err.message };
  }
}
