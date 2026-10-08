import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { rateLimit } from "../../lib/rateLimit.js";
import * as ctrl from "./auth.controller.js";
import { loginSchema, changePasswordSchema, acceptInviteSchema, inviteTokenSchema } from "./auth.validation.js";

const router = Router();

// Unauthenticated endpoints that take a guessable secret — a password or an invite token — are
// the ones worth limiting (prompt-125). There was no limiter at all before this; login could be
// hammered indefinitely. Generous enough that a person fumbling a password never meets it.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, name: "sign-in attempts" });
// Tighter, because the invite token is 32 random bytes and nobody types one by hand: every
// request here is either a real link being opened or someone guessing.
const inviteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, name: "invite lookups" });

router.post("/login", authLimiter, validate(loginSchema), ctrl.login);
router.get("/me", authenticate, ctrl.me);
router.post("/change-password", authenticate, validate(changePasswordSchema), ctrl.changePassword);

// ── Public invite acceptance (prompt-125) ───────────────────────────────────────────────────
//
// Deliberately NOT behind `authenticate`: the whole point is that the person has no account yet.
// They are instead gated by possession of a 32-byte token and by the limiter above.
//
// Both return the SAME generic 404 for invalid, expired, already-used and revoked tokens — see
// invites.service.js. Any difference between those cases tells someone probing links which of
// their guesses was once real.
router.get("/invite/:token", inviteLimiter, validate(inviteTokenSchema), ctrl.describeInvite);
router.post("/accept-invite", inviteLimiter, validate(acceptInviteSchema), ctrl.acceptInvite);

export default router;
