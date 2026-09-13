import Client from "../clients/client.model.js";
import { createEntry } from "../journal/journal.service.js";
import { normalizePhone } from "../../lib/phone.js";
import { uploadImage } from "../../lib/storage.js";
import { ApiError } from "../../lib/ApiError.js";

// WhatsApp → journal intake (prompt-91).
//
// This module contains NO WhatsApp-specific code on purpose: no signature verification, no
// Meta/Green API client, no media-token handling. n8n owns the WhatsApp connection and hands
// this endpoint already-parsed input — a sender number, optional text, optional photo URL.
// Everything here is ordinary application logic, which is what makes it testable with curl.

// A WhatsApp media URL is short-lived and usually needs the provider's own credentials to
// fetch, so storing it as the permanent reference would leave a dead link within hours. The
// photo is pulled once, here, and re-uploaded to our own bucket via the same uploadImage()
// every other image in the app goes through.
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_FETCH_TIMEOUT_MS = 15_000;

async function fetchPhotoBuffer(photoUrl) {
  let parsed;
  try {
    parsed = new URL(photoUrl);
  } catch {
    throw new ApiError(400, "photoUrl is not a valid URL");
  }
  // The server fetches a URL the caller supplied, so restrict the scheme rather than letting
  // file:// or similar through. The caller is authenticated with a scoped key, which is the
  // main control here; this is the cheap second line.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ApiError(400, "photoUrl must be an http(s) URL");
  }

  let res;
  try {
    res = await fetch(photoUrl, {
      signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS),
      // Identify ourselves: a WhatsApp media host won't care, but plenty of general-purpose
      // CDNs reject the default fetch agent outright (Wikimedia answers it with a 400), and
      // that failure mode is indistinguishable from a broken link in the logs.
      headers: { "user-agent": "Nutria-Intake/1.0 (+journal photo fetch)" },
    });
  } catch (err) {
    // 502, not 500: the failure is upstream, and n8n should treat it as "retry the media
    // download" rather than "this payload is broken".
    throw new ApiError(502, `Couldn't download photoUrl: ${err.message}`);
  }
  if (!res.ok) {
    throw new ApiError(502, `Couldn't download photoUrl: upstream responded ${res.status}`);
  }

  const declared = Number(res.headers.get("content-length"));
  if (declared && declared > MAX_PHOTO_BYTES) {
    throw new ApiError(413, `Photo is larger than ${MAX_PHOTO_BYTES / 1024 / 1024} MB`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  // Re-checked after the read: content-length is a claim, not a guarantee.
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new ApiError(413, `Photo is larger than ${MAX_PHOTO_BYTES / 1024 / 1024} MB`);
  }
  if (buffer.length === 0) {
    throw new ApiError(502, "photoUrl returned an empty response");
  }
  return buffer;
}

// Matching is by exact phone equality AFTER running the sender through the same
// normalizePhone() that clients.service.js runs on every phone it stores — so both sides of
// the comparison are produced by one function and can't drift into different conventions.
// Client.phone is uniquely indexed, so a match is unambiguous by construction.
export async function findClientByPhone(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { phone: null, client: null };
  const client = await Client.findOne({ phone })
    .select("_id phone archived profile.firstName profile.lastName")
    .lean();
  return { phone, client };
}

export async function createJournalEntryFromWhatsApp(data, actor) {
  const { phone, client } = await findClientByPhone(data.phone);

  // No match → reject, loudly. The alternative (park it somewhere for triage) isn't available
  // without inventing a placeholder Client: JournalEntry.client is `required` and there is no
  // "unassigned" bucket, so an unmatched entry would either fail validation or force a fake
  // client into the roster. A 404 keeps the bad data out of the chart and hands n8n something
  // it can branch on, and echoing the normalized number back makes the usual cause —
  // a formatting mismatch — visible immediately instead of looking like a missing client.
  if (!client) {
    throw new ApiError(404, `No client matches the WhatsApp number ${phone ?? data.phone}`, {
      code: "client_not_found",
      normalizedPhone: phone,
      receivedPhone: data.phone,
    });
  }

  const photo = data.photoUrl ? await uploadImage(await fetchPhotoBuffer(data.photoUrl), "journal") : null;

  // The journal source enum has no plain "whatsapp" value — it distinguishes whatsapp-text
  // from whatsapp-photo, and the Journal Review page already renders a different icon and
  // label for each. A payload carrying a photo is a photo log even when text came with it.
  const source = data.photoUrl ? "whatsapp-photo" : "whatsapp-text";

  // Straight through journal.service.js's own createEntry — the single entry-creation path.
  // It is what forces status "pending" for any non-dashboard source and what preserves
  // confidence/flags, so intake inherits that behaviour instead of restating it.
  return createEntry(
    {
      client: client._id,
      date: data.date ? new Date(data.date) : new Date(),
      kind: "meal",
      mealSlot: data.mealSlot ?? null,
      source,
      // "[photo]" mirrors the convention documented on the model's rawMessage field, so a
      // photo-only log still reads as something in the review list rather than a blank row.
      rawMessage: data.message?.trim() || "[photo]",
      photo,
      items: data.items ?? [],
      confidence: data.confidence ?? null,
      flags: data.flags ?? [],
    },
    actor,
  );
}
