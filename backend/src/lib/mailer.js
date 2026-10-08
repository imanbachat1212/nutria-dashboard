import { env } from "../config/env.js";

// Outbound email via Resend's REST API (prompt-125).
//
// `fetch` rather than the resend SDK: Node 20 has fetch built in, the API is one POST, and this
// backend's convention for outbound HTTP is already a bare fetch with an explicit timeout (see
// lib/openrouter.js, modules/foods/lib/usda-client.js, lib/n8n.js). A dependency for one request
// would be the odd one out.
//
// NOTHING HERE EVER THROWS. An invite is useful without the email — the inviter can always copy
// the link — so a mail outage must not fail invite creation and leave the UI unable to say what
// happened. Every path returns { sent: boolean, error: string|null } instead.

const TIMEOUT_MS = 10_000;

export function isMailConfigured() {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
}

/**
 * Sends one invite email.
 *
 * @returns {Promise<{ sent: boolean, error: string|null }>}
 */
export async function sendInviteEmail({ to, inviterName, roleLabel, acceptUrl, expiresAt }) {
  if (!isMailConfigured()) {
    // Not an error: a practice that hasn't set RESEND_API_KEY yet invites people by copying the
    // link. The caller reports emailSent:false and the UI shows the link prominently.
    return { sent: false, error: null };
  }

  const expires = new Date(expiresAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const who = inviterName ? `${inviterName} has` : "You have been";
  const subject = "You've been invited to Nutria";

  // Plain, narrow HTML. No images, no external CSS, no tracking — this has to render in any mail
  // client and contains a credential, so the fewer moving parts the better.
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f8f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2b26">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e3eae7;border-radius:12px;padding:28px">
    <h1 style="margin:0 0 14px;font-size:19px">Join the team on Nutria</h1>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55">${escapeHtml(who)} been invited to join as <strong>${escapeHtml(roleLabel)}</strong>.</p>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.55">Choose a password to finish setting up your account.</p>
    <p style="margin:0 0 22px"><a href="${acceptUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">Accept invitation</a></p>
    <p style="margin:0;font-size:12px;color:#6b7f78;line-height:1.5">This link expires on ${escapeHtml(expires)} and can only be used once. If you weren't expecting it, you can ignore this email.</p>
  </div></body></html>`;

  const text = [
    `${who} been invited to join Nutria as ${roleLabel}.`,
    "",
    "Open this link to choose a password and finish setting up your account:",
    acceptUrl,
    "",
    `The link expires on ${expires} and can only be used once.`,
    "If you weren't expecting this email, you can ignore it.",
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html, text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Resend's message, not the body verbatim — the body echoes the request, and the request
      // contains the accept URL. Nothing that reaches a log or an API response may carry it.
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) detail = `${detail}: ${String(body.message).slice(0, 160)}`;
      } catch { /* non-JSON error body */ }
      return { sent: false, error: detail };
    }
    return { sent: true, error: null };
  } catch (err) {
    return { sent: false, error: err.name === "AbortError" ? "Mail provider timed out" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
