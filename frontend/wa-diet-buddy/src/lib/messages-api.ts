import { api } from "./api";

// Real Messages inbox (prompt-96), replacing lib/messages-mock.ts.
//
// The types below deliberately mirror the mock's `Conversation` / `ChatMessage` field-for-field
// where a real field exists, so routes/messages.tsx is a data-source swap rather than a
// redesign. The fields the mock had that nothing can populate yet are documented at the bottom.

export type ConversationKind = "client" | "lead";
export type MessageDirection = "in" | "out";
export type MessageAuthor = "contact" | "ai" | "dietitian";
export type MessageKind = "text" | "image" | "voice" | "plan" | "system";
export type MessageStatus = "queued" | "sent" | "failed" | null;

export interface ChatMessage {
  id: string;
  direction: MessageDirection;
  // Derived server-side from direction + source: inbound is the contact, outbound is the AI
  // when n8n logged it and the dietitian when the dashboard sent it.
  author: MessageAuthor;
  kind: MessageKind;
  text: string;
  at: string;
  attachmentLabel: string | null;
  status: MessageStatus;
  error: string | null;
}

export interface ConversationSummary {
  id: string;
  kind: ConversationKind;
  contactId: string;
  name: string;
  phone: string;
  avatarInitials: string;
  tag: string | null;
  lastSnippet: string;
  lastAtIso: string;
  // "inbound messages since the last reply", i.e. awaiting a response — NOT read receipts.
  unread: number;
  aiAutopilot: boolean;
  awaitingDietitian: boolean;
  messageCount: number;
}

export interface Thread extends Omit<ConversationSummary, "lastSnippet" | "lastAtIso" | "unread" | "awaitingDietitian" | "messageCount"> {
  messages: ChatMessage[];
}

export interface MessagesStatus {
  lastMessageAt: string | null;
  recentlyActive: boolean;
  windowMinutes: number;
  outboundConfigured: boolean;
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  return api.get<ConversationSummary[]>("/api/messages");
}

export async function fetchThread(clientId: string): Promise<Thread> {
  return api.get<Thread>(`/api/messages/${clientId}`);
}

export async function fetchMessagesStatus(): Promise<MessagesStatus> {
  return api.get<MessagesStatus>("/api/messages/status");
}

// Writes the message, then asks n8n to deliver it. Resolves even when delivery fails — the
// message is stored either way, with `delivered: false` and the reason, so the thread can show
// it as failed instead of losing what was typed.
export async function sendMessage(
  clientId: string,
  body: string,
): Promise<{ message: ChatMessage; delivered: boolean; error: string | null }> {
  return api.post("/api/messages/send", { client: clientId, body });
}

// Autopilot lives on the Client, so it toggles through the normal client update endpoint.
export async function setAiAutopilot(clientId: string, aiAutopilot: boolean): Promise<void> {
  await api.patch(`/api/clients/${clientId}`, { aiAutopilot });
}

// ── Display helpers, lifted verbatim from messages-mock.ts so the UI formats identically ──
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

// Relative label for the conversation list ("2 min"), which the mock stored as a frozen string.
export function relativeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ── Mock fields with no real source, deliberately not built ──────────────────────────────────
// pinned        — nothing sets it; a pin needs its own per-conversation store and a UI to set it.
// assignedTo    — team assignment is a feature, not a field; the team module is still mock.
// flagged       — per-message flag with no producer. Journal entries have flags; messages don't.
// voiceSeconds  — n8n doesn't send duration; attachmentLabel covers the display.
// status "delivered"/"read" — needs WhatsApp delivery receipts flowing back through n8n, which
//                 don't exist yet. Inventing them would put meaningless ticks in the UI.
