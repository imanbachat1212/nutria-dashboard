export type ConversationKind = "client" | "lead";
export type MessageDirection = "in" | "out";
export type MessageAuthor = "contact" | "ai" | "dietitian";
export type MessageKind = "text" | "image" | "voice" | "plan" | "system";

export interface ChatMessage {
  id: string;
  direction: MessageDirection;
  author: MessageAuthor;
  kind: MessageKind;
  text: string;
  at: string; // ISO
  status?: "sent" | "delivered" | "read";
  attachmentLabel?: string;
  voiceSeconds?: number;
  flagged?: boolean;
}

export interface Conversation {
  id: string;
  kind: ConversationKind;
  contactId: string; // links to client or lead id
  name: string;
  phone: string;
  avatarInitials: string;
  tag?: string; // e.g. "Diet", "Lead • IG"
  lastSnippet: string;
  lastAt: string; // relative
  lastAtIso: string;
  unread: number;
  pinned?: boolean;
  aiAutopilot: boolean; // AI handling unless dietitian takes over
  awaitingDietitian?: boolean; // flagged for review
  assignedTo?: string;
  messages: ChatMessage[];
}

export const CONVERSATIONS: Conversation[] = [
  {
    id: "C-001",
    kind: "client",
    contactId: "CL-1001",
    name: "Lara Hachem",
    phone: "+961 70 112 339",
    avatarInitials: "LH",
    tag: "Diet • PCOS",
    lastSnippet: "Sent lunch photo 🍲",
    lastAt: "2 min",
    lastAtIso: "2026-06-18T09:58:00Z",
    unread: 2,
    pinned: true,
    aiAutopilot: true,
    awaitingDietitian: true,
    assignedTo: "Dr. Layla",
    messages: [
      {
        id: "m1",
        direction: "in",
        author: "contact",
        kind: "text",
        text: "Good morning! Skipped breakfast, only coffee ☕",
        at: "2026-06-18T07:12:00Z",
        status: "read",
      },
      {
        id: "m2",
        direction: "out",
        author: "ai",
        kind: "text",
        text: "Morning Lara 🌿 Try to have at least a yogurt + fruit within the next hour — we don't want to start the day fasted with PCOS.",
        at: "2026-06-18T07:13:00Z",
        status: "read",
      },
      {
        id: "m3",
        direction: "in",
        author: "contact",
        kind: "image",
        text: "",
        attachmentLabel: "lunch.jpg",
        at: "2026-06-18T09:55:00Z",
        status: "delivered",
      },
      {
        id: "m4",
        direction: "in",
        author: "contact",
        kind: "text",
        text: "Is this portion okay? Grilled chicken, rice, salad.",
        at: "2026-06-18T09:58:00Z",
        status: "delivered",
        flagged: true,
      },
    ],
  },
  {
    id: "C-002",
    kind: "lead",
    contactId: "L-1001",
    name: "Maya Khalil",
    phone: "+961 70 112 339",
    avatarInitials: "MK",
    tag: "Lead • Instagram",
    lastSnippet: "Sure 🙏",
    lastAt: "12 min",
    lastAtIso: "2026-06-18T09:48:00Z",
    unread: 1,
    aiAutopilot: true,
    messages: [
      {
        id: "m1",
        direction: "in",
        author: "contact",
        kind: "text",
        text: "Hi, I saw your reel about PCOS plans. Do you take new clients?",
        at: "2026-06-18T09:46:00Z",
      },
      {
        id: "m2",
        direction: "out",
        author: "ai",
        kind: "text",
        text: "Hi Maya! Yes, we have openings. Can I ask a few quick questions to match the right plan?",
        at: "2026-06-18T09:47:00Z",
        status: "read",
      },
      {
        id: "m3",
        direction: "in",
        author: "contact",
        kind: "text",
        text: "Sure 🙏",
        at: "2026-06-18T09:48:00Z",
      },
    ],
  },
  {
    id: "C-003",
    kind: "client",
    contactId: "CL-1002",
    name: "Rami Haddad",
    phone: "+961 71 884 220",
    avatarInitials: "RH",
    tag: "Diet + Gym",
    lastSnippet: "Voice note (0:42)",
    lastAt: "1 h",
    lastAtIso: "2026-06-18T08:55:00Z",
    unread: 0,
    aiAutopilot: false,
    assignedTo: "Coach Elie",
    messages: [
      {
        id: "m1",
        direction: "out",
        author: "dietitian",
        kind: "text",
        text: "How did the leg day go yesterday?",
        at: "2026-06-18T08:30:00Z",
        status: "read",
      },
      {
        id: "m2",
        direction: "in",
        author: "contact",
        kind: "voice",
        text: "",
        voiceSeconds: 42,
        at: "2026-06-18T08:55:00Z",
      },
    ],
  },
  {
    id: "C-004",
    kind: "client",
    contactId: "CL-1003",
    name: "Sara Obeid",
    phone: "+961 76 553 109",
    avatarInitials: "SO",
    tag: "Diet",
    lastSnippet: "Plan delivered — Week 3 of 12",
    lastAt: "3 h",
    lastAtIso: "2026-06-18T06:30:00Z",
    unread: 0,
    aiAutopilot: true,
    messages: [
      {
        id: "m1",
        direction: "out",
        author: "ai",
        kind: "plan",
        text: "Here's your plan for today — 1,650 kcal · P140 C160 F50",
        attachmentLabel: "Week 3 · Day 4",
        at: "2026-06-18T06:30:00Z",
        status: "read",
      },
    ],
  },
  {
    id: "C-005",
    kind: "lead",
    contactId: "L-1009",
    name: "Tala Rizk",
    phone: "+961 76 220 008",
    avatarInitials: "TR",
    tag: "Lead • WhatsApp",
    lastSnippet: "Hello, prices please 🙂",
    lastAt: "1 h",
    lastAtIso: "2026-06-18T08:50:00Z",
    unread: 1,
    aiAutopilot: true,
    messages: [
      {
        id: "m1",
        direction: "in",
        author: "contact",
        kind: "text",
        text: "Hello, prices please 🙂",
        at: "2026-06-18T08:50:00Z",
      },
    ],
  },
  {
    id: "C-006",
    kind: "client",
    contactId: "CL-1004",
    name: "Karim Aoun",
    phone: "+961 78 220 441",
    avatarInitials: "KA",
    tag: "Gym",
    lastSnippet: "Logged: Squat 5x5 @ 90kg ✅",
    lastAt: "yesterday",
    lastAtIso: "2026-06-17T18:10:00Z",
    unread: 0,
    aiAutopilot: true,
    messages: [
      {
        id: "m1",
        direction: "in",
        author: "contact",
        kind: "text",
        text: "Logged: Squat 5x5 @ 90kg ✅",
        at: "2026-06-17T18:10:00Z",
      },
      {
        id: "m2",
        direction: "out",
        author: "ai",
        kind: "text",
        text: "Strong work 💪 next session we push to 92.5kg.",
        at: "2026-06-17T18:11:00Z",
        status: "read",
      },
    ],
  },
  {
    id: "C-007",
    kind: "client",
    contactId: "CL-1005",
    name: "Lina Saab",
    phone: "+961 70 901 002",
    avatarInitials: "LS",
    tag: "Diet • Menopause",
    lastSnippet: "Appointment confirmed for Wed 4pm",
    lastAt: "yesterday",
    lastAtIso: "2026-06-17T14:00:00Z",
    unread: 0,
    aiAutopilot: true,
    messages: [
      {
        id: "m1",
        direction: "out",
        author: "ai",
        kind: "system",
        text: "Appointment confirmed for Wed 4:00pm with Dr. Layla.",
        at: "2026-06-17T14:00:00Z",
        status: "read",
      },
    ],
  },
  {
    id: "C-008",
    kind: "client",
    contactId: "CL-1006",
    name: "Joe Daou",
    phone: "+961 71 002 887",
    avatarInitials: "JD",
    tag: "Diet",
    lastSnippet: "Weighed in at 78.4 kg this morning",
    lastAtIso: "2026-06-16T07:00:00Z",
    lastAt: "2 days",
    unread: 0,
    aiAutopilot: true,
    messages: [
      {
        id: "m1",
        direction: "in",
        author: "contact",
        kind: "text",
        text: "Weighed in at 78.4 kg this morning",
        at: "2026-06-16T07:00:00Z",
      },
    ],
  },
];

// Use UTC for SSR-stable output (avoids hydration mismatch between server and client tz).
export function formatClock(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  } catch {
    return "";
  }
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDay(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date("2026-06-18T00:00:00Z");
    const yest = new Date("2026-06-17T00:00:00Z");
    const sameDay = (a: Date, b: Date) =>
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate();
    if (sameDay(d, today)) return "Today";
    if (sameDay(d, yest)) return "Yesterday";
    return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  } catch {
    return "";
  }
}
