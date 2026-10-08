import { ApiError } from "./ApiError.js";

// A small fixed-window rate limiter (prompt-125).
//
// Hand-rolled rather than express-rate-limit, matching this backend's standing preference for not
// taking a dependency for something small (see lib/mailer.js, lib/openrouter.js). The trade is
// stated plainly: state lives in THIS PROCESS's memory, so it resets on deploy and is per-instance
// rather than per-cluster. For a single-instance deployment protecting a login form and a public
// invite lookup, that is the right size. If the API is ever scaled to more than one instance, this
// needs to move to a shared store — it will still work, it will just allow N× the configured rate.
//
// It exists because these routes are unauthenticated and carry a guessable credential: without it,
// /api/auth/invite/:token can be probed indefinitely, and the deliberately generic 404 that hides
// whether a token was real is worth much less if an attacker can simply try millions of them.

const buckets = new Map();

// Bounded cleanup so a long-running process doesn't accumulate a key per IP forever.
const SWEEP_EVERY = 5000;
let sinceSweep = 0;

function sweep(now) {
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * @param {object} opts
 * @param {number} opts.windowMs  Window length.
 * @param {number} opts.max       Requests allowed per key per window.
 * @param {string} opts.name      Used in the error message.
 */
export function rateLimit({ windowMs, max, name = "requests" }) {
  return (req, _res, next) => {
    const now = Date.now();
    if (++sinceSweep >= SWEEP_EVERY) {
      sinceSweep = 0;
      sweep(now);
    }

    // req.ip is only meaningful because app.js sets `trust proxy` — without it every request
    // behind Render's edge would share one bucket, i.e. one global limit for the whole internet.
    const key = `${name}:${req.ip}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      throw new ApiError(429, `Too many ${name}. Try again in ${retryAfter}s.`, {
        code: "rate_limited",
        retryAfter,
      });
    }
    return next();
  };
}
