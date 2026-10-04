import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

// The backend's only LLM client (prompt-120).
//
// WHY THIS IS NEW, not a copy of an existing pattern: the brief expected an OpenRouter call to
// already exist here, modelled on the WhatsApp coach's "Build Identify Request" step. It does
// not. lib/n8n.js is a plain webhook POST with no model call, and nothing in this repo has ever
// talked to a model — the coach's prompt-building and OpenRouter call both live inside the n8n
// workflow itself, which is external to this codebase. So this is written from scratch against
// the conventions this repo DOES have for outbound HTTP (foods/lib/usda-client.js, lib/n8n.js):
// a required-config guard, a bare fetch, an explicit timeout, upstream failures mapped to 502
// with a message a human can act on, and no retries.
//
// Deliberately not a generic "chat" helper: the only thing the backend ever needs from a model
// is a JSON object matching a shape it already knows, so the single exported call does the
// response-format pinning, the fence-stripping and the JSON.parse, and throws if the model
// returns something unparseable. Callers get an object or an error, never a string to
// post-process.
const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

// Generous relative to the 10s n8n send: this is one batched call covering every ingredient
// line in a recipe, and it runs inside a request the user is already watching a spinner for.
const TIMEOUT_MS = 45_000;

export function isAiConfigured() {
  return env.AI_PROVIDER === "openrouter" && !!env.OPENROUTER_API_KEY;
}

// Strips ```json fences some models still wrap JSON in despite response_format. Cheap to do
// unconditionally; a bare JSON string is unaffected.
function stripFence(text) {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  return t
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/**
 * Ask the model for one JSON object.
 *
 * @param {object}  opts
 * @param {string}  opts.system  System prompt — the shape contract.
 * @param {string}  opts.user    The actual payload to transform.
 * @param {string} [opts.model]  Overrides OPENROUTER_MODEL.
 * @returns {Promise<any>} The parsed JSON value the model returned.
 */
export async function chatJson({ system, user, model }) {
  if (!isAiConfigured()) {
    throw new ApiError(
      503,
      "AI is not configured — set OPENROUTER_API_KEY in the backend .env (and AI_PROVIDER=openrouter)",
    );
  }

  let res;
  try {
    res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // OpenRouter uses these purely for attribution on their dashboard. Harmless, and it
        // makes this app's traffic identifiable if the key is ever shared with another tool.
        "X-Title": "Nutria",
      },
      body: JSON.stringify({
        model: model || env.OPENROUTER_MODEL,
        // Mechanical extraction, not creative writing — temperature 0 so the same recipe maps
        // to the same ingredient split every time it's imported.
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    throw new ApiError(
      502,
      timedOut
        ? `The AI provider did not respond within ${TIMEOUT_MS / 1000}s`
        : `Couldn't reach the AI provider: ${err.message}`,
    );
  }

  if (!res.ok) {
    // OpenRouter puts a human-readable reason in the body for the cases that matter most
    // (no credit, bad key, model not available) — surface it rather than just the status.
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message ? ` — ${body.error.message}` : "";
    } catch {
      /* non-JSON error body; the status alone will have to do */
    }
    throw new ApiError(502, `AI provider rejected the request (${res.status})${detail}`);
  }

  const body = await res.json();
  const content = body?.choices?.[0]?.message?.content;
  if (!content) {
    throw new ApiError(502, "AI provider returned an empty response");
  }

  try {
    return JSON.parse(stripFence(content));
  } catch {
    throw new ApiError(502, "AI provider returned a response that wasn't valid JSON");
  }
}
