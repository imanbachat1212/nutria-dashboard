import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

// The backend's one outbound call to n8n (prompt-96).
//
// This is the whole of the app's "ability to send WhatsApp": it asks n8n to do it. There is no
// Meta/WhatsApp Cloud API client here and there must not be one — n8n owns the WhatsApp
// connection, its credentials and its rate limits, and this side owns nothing but the request.
//
// Structured like the USDA client (src/modules/foods/lib/usda-client.js): a required-config
// guard, a bare fetch, upstream failures mapped to 502 with a message a human can act on. No
// retries, deliberately — a retried send is a duplicate WhatsApp message to a real person, and
// "it might have sent twice" is worse than "it didn't send, try again".
const SEND_TIMEOUT_MS = 10_000;

export function isOutboundConfigured() {
  return !!env.N8N_OUTBOUND_WEBHOOK_URL;
}

export async function sendWhatsAppViaN8n({ phone, message }) {
  if (!env.N8N_OUTBOUND_WEBHOOK_URL) {
    throw new ApiError(
      503,
      "Outbound WhatsApp is not configured — set N8N_OUTBOUND_WEBHOOK_URL in the backend .env",
    );
  }

  let res;
  try {
    res = await fetch(env.N8N_OUTBOUND_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Shared secret, because this URL can trigger a real WhatsApp message to a real client.
        // A webhook URL is not a credential: it travels in logs, browser history and workflow
        // exports. Omitted from the request entirely when unset, so n8n can tell "no secret
        // configured" from "wrong secret".
        ...(env.N8N_OUTBOUND_SECRET ? { "X-Nutria-Secret": env.N8N_OUTBOUND_SECRET } : {}),
      },
      body: JSON.stringify({ phone, message }),
      // Bounded wait. A dietitian pressing send must get an answer; n8n being slow or down must
      // not hold the request open until the browser gives up with nothing written.
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    throw new ApiError(
      502,
      timedOut
        ? `n8n did not respond within ${SEND_TIMEOUT_MS / 1000}s`
        : `Couldn't reach n8n: ${err.message}`,
    );
  }

  if (!res.ok) {
    throw new ApiError(502, `n8n rejected the send (${res.status})`);
  }
  // The response body is ignored on purpose: the contract is the status code. n8n can return
  // whatever is convenient without this side needing a matching parser.
  return true;
}
