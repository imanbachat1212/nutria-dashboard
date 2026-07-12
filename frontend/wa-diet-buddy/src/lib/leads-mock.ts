export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "consult-booked"
  | "converted"
  | "lost";

export type LeadSource =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "referral"
  | "website"
  | "tiktok";

export type LeadInterest = "diet" | "gym" | "diet+gym" | "consult";

export interface LeadMessage {
  id: string;
  from: "lead" | "ai" | "dietitian";
  text: string;
  at: string;
}

export interface LeadRecord {
  id: string;
  name: string;
  phone: string;
  avatarInitials: string;
  source: LeadSource;
  interest: LeadInterest;
  stage: LeadStage;
  city?: string;
  ageRange?: string;
  budget?: "low" | "mid" | "high";
  capturedAt: string; // ISO
  daysInStage: number;
  lastMessageAt: string; // relative
  lastMessagePreview: string;
  unread: number;
  assignedTo?: string;
  qualityScore: number; // 0-100, AI scored
  tags: string[];
  notes?: string;
  thread: LeadMessage[];
}

export const STAGES: { key: LeadStage; label: string; tone: string }[] = [
  { key: "new", label: "New", tone: "bg-chart-1/15 text-chart-1 border-chart-1/30" },
  { key: "contacted", label: "Contacted", tone: "bg-chart-4/15 text-chart-4 border-chart-4/30" },
  { key: "qualified", label: "Qualified", tone: "bg-primary/15 text-primary border-primary/30" },
  {
    key: "consult-booked",
    label: "Consult booked",
    tone: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  },
  { key: "converted", label: "Converted", tone: "bg-success/15 text-success border-success/40" },
  { key: "lost", label: "Lost", tone: "bg-muted text-muted-foreground border-border" },
];

export const SOURCE_LABEL: Record<LeadSource, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  referral: "Referral",
  website: "Website",
  tiktok: "TikTok",
};

export const INTEREST_LABEL: Record<LeadInterest, string> = {
  diet: "Diet",
  gym: "Gym",
  "diet+gym": "Diet + Gym",
  consult: "Consult",
};

export const LEADS: LeadRecord[] = [
  {
    id: "L-1001",
    name: "Maya Khalil",
    phone: "+961 70 112 339",
    avatarInitials: "MK",
    source: "instagram",
    interest: "diet",
    stage: "new",
    city: "Beirut",
    ageRange: "25-34",
    budget: "mid",
    capturedAt: "2026-06-17T08:42:00Z",
    daysInStage: 0,
    lastMessageAt: "12 min ago",
    lastMessagePreview: "Hi, I saw your reel about PCOS plans. Do you take new clients?",
    unread: 2,
    qualityScore: 82,
    tags: ["pcos", "ig-reel"],
    thread: [
      { id: "m1", from: "lead", at: "12 min ago", text: "Hi, I saw your reel about PCOS plans. Do you take new clients?" },
      { id: "m2", from: "ai", at: "11 min ago", text: "Hi Maya! Yes, we have openings. Can I ask a few quick questions to match the right plan?" },
      { id: "m3", from: "lead", at: "9 min ago", text: "Sure 🙏" },
    ],
  },
  {
    id: "L-1002",
    name: "Rami Haddad",
    phone: "+961 71 884 220",
    avatarInitials: "RH",
    source: "whatsapp",
    interest: "diet+gym",
    stage: "contacted",
    city: "Jounieh",
    ageRange: "35-44",
    budget: "high",
    capturedAt: "2026-06-15T14:10:00Z",
    daysInStage: 1,
    lastMessageAt: "2 h ago",
    lastMessagePreview: "I'd like a combined plan. Weight is 96kg, goal 82kg.",
    unread: 0,
    assignedTo: "Dr. Nour",
    qualityScore: 91,
    tags: ["combo", "referral-by-Karim"],
    thread: [
      { id: "m1", from: "lead", at: "2 h ago", text: "I'd like a combined plan. Weight is 96kg, goal 82kg." },
      { id: "m2", from: "ai", at: "2 h ago", text: "Great — sending you our 3-month combined package details now." },
    ],
  },
  {
    id: "L-1003",
    name: "Sara Obeid",
    phone: "+961 76 553 109",
    avatarInitials: "SO",
    source: "referral",
    interest: "diet",
    stage: "qualified",
    city: "Tripoli",
    ageRange: "18-24",
    budget: "low",
    capturedAt: "2026-06-13T09:00:00Z",
    daysInStage: 2,
    lastMessageAt: "yesterday",
    lastMessagePreview: "Can we do the consult on Thursday after 5pm?",
    unread: 1,
    assignedTo: "Dr. Nour",
    qualityScore: 74,
    tags: ["student"],
    thread: [
      { id: "m1", from: "lead", at: "yesterday", text: "Can we do the consult on Thursday after 5pm?" },
    ],
  },
  {
    id: "L-1004",
    name: "Karim Aoun",
    phone: "+961 78 220 441",
    avatarInitials: "KA",
    source: "tiktok",
    interest: "gym",
    stage: "qualified",
    city: "Beirut",
    ageRange: "18-24",
    budget: "mid",
    capturedAt: "2026-06-12T16:30:00Z",
    daysInStage: 3,
    lastMessageAt: "yesterday",
    lastMessagePreview: "Looking for hypertrophy program, 4 days/week.",
    unread: 0,
    assignedTo: "Coach Elie",
    qualityScore: 80,
    tags: ["hypertrophy"],
    thread: [
      { id: "m1", from: "lead", at: "yesterday", text: "Looking for hypertrophy program, 4 days/week." },
    ],
  },
  {
    id: "L-1005",
    name: "Lina Saab",
    phone: "+961 70 901 002",
    avatarInitials: "LS",
    source: "website",
    interest: "consult",
    stage: "consult-booked",
    city: "Saida",
    ageRange: "45-54",
    budget: "high",
    capturedAt: "2026-06-10T12:00:00Z",
    daysInStage: 1,
    lastMessageAt: "today",
    lastMessagePreview: "Confirmed — Wed 4:00pm.",
    unread: 0,
    assignedTo: "Dr. Nour",
    qualityScore: 95,
    tags: ["menopause", "high-intent"],
    thread: [
      { id: "m1", from: "ai", at: "today", text: "Your consult is confirmed for Wed 4:00pm. See you then 🌿" },
    ],
  },
  {
    id: "L-1006",
    name: "Joe Daou",
    phone: "+961 71 002 887",
    avatarInitials: "JD",
    source: "instagram",
    interest: "diet",
    stage: "consult-booked",
    city: "Beirut",
    ageRange: "25-34",
    budget: "mid",
    capturedAt: "2026-06-11T10:30:00Z",
    daysInStage: 2,
    lastMessageAt: "2 days ago",
    lastMessagePreview: "Sounds good, see you Friday.",
    unread: 0,
    assignedTo: "Dr. Nour",
    qualityScore: 78,
    tags: [],
    thread: [],
  },
  {
    id: "L-1007",
    name: "Nour Fares",
    phone: "+961 70 445 119",
    avatarInitials: "NF",
    source: "referral",
    interest: "diet+gym",
    stage: "converted",
    city: "Beirut",
    ageRange: "25-34",
    budget: "high",
    capturedAt: "2026-06-01T09:00:00Z",
    daysInStage: 4,
    lastMessageAt: "Mon",
    lastMessagePreview: "Paid! Excited to start 🙌",
    unread: 0,
    assignedTo: "Dr. Nour",
    qualityScore: 97,
    tags: ["paid", "3-month"],
    thread: [],
  },
  {
    id: "L-1008",
    name: "Hadi Mansour",
    phone: "+961 78 339 117",
    avatarInitials: "HM",
    source: "facebook",
    interest: "diet",
    stage: "lost",
    city: "Zahle",
    ageRange: "35-44",
    budget: "low",
    capturedAt: "2026-06-05T11:20:00Z",
    daysInStage: 7,
    lastMessageAt: "last week",
    lastMessagePreview: "Maybe later, thanks.",
    unread: 0,
    qualityScore: 40,
    tags: ["price-objection"],
    thread: [],
  },
  {
    id: "L-1009",
    name: "Tala Rizk",
    phone: "+961 76 220 008",
    avatarInitials: "TR",
    source: "whatsapp",
    interest: "diet",
    stage: "new",
    city: "Byblos",
    ageRange: "25-34",
    budget: "mid",
    capturedAt: "2026-06-17T07:15:00Z",
    daysInStage: 0,
    lastMessageAt: "1 h ago",
    lastMessagePreview: "Hello, prices please 🙂",
    unread: 1,
    qualityScore: 55,
    tags: ["price-inquiry"],
    thread: [
      { id: "m1", from: "lead", at: "1 h ago", text: "Hello, prices please 🙂" },
    ],
  },
  {
    id: "L-1010",
    name: "Omar Chami",
    phone: "+961 71 776 540",
    avatarInitials: "OC",
    source: "instagram",
    interest: "gym",
    stage: "contacted",
    city: "Beirut",
    ageRange: "18-24",
    budget: "low",
    capturedAt: "2026-06-16T19:40:00Z",
    daysInStage: 1,
    lastMessageAt: "5 h ago",
    lastMessagePreview: "Do you have a student discount?",
    unread: 0,
    qualityScore: 60,
    tags: ["student"],
    thread: [],
  },
];

export function leadsByStage(stage: LeadStage) {
  return LEADS.filter((l) => l.stage === stage);
}
