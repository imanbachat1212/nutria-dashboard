import { ApiError } from "../lib/ApiError.js";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // An over-limit request body (prompt-123). body-parser throws PayloadTooLargeError with its
  // own stable discriminator and an already-correct `err.status` of 413 — which this handler
  // used to discard, reporting "Internal server error" to the caller. For the inbound-photo
  // endpoint that is actively misleading: it tells n8n the server broke when the truth is "that
  // photo is bigger than the route accepts", which is something the caller can act on.
  //
  // Matched on `err.type` rather than on `err.status` generally: a narrow, unambiguous mapping
  // for one known error, with no risk of reclassifying some other library's error that happens
  // to carry a status. (Note the sibling case `entity.parse.failed` — malformed JSON — is still
  // a 500 here and arguably should be a 400; left alone as out of scope, see the report.)
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error: `Request body is too large for this endpoint (limit ${err.limit} bytes)`,
      details: { code: "payload_too_large", limit: err.limit, received: err.length ?? null },
    });
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
