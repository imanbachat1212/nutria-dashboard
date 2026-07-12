export type FormStatus = "live" | "draft" | "archived";
export type FieldType =
  | "short-text"
  | "long-text"
  | "number"
  | "single-choice"
  | "multi-choice"
  | "date"
  | "file"
  | "scale"
  | "signature";

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
}

export interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
}

export interface IntakeForm {
  id: string;
  title: string;
  category: "onboarding" | "medical" | "lifestyle" | "follow-up" | "consent";
  status: FormStatus;
  description: string;
  language: "EN" | "AR" | "FR" | "EN/AR";
  sections: FormSection[];
  stats: {
    sent: number;
    completed: number;
    avgMinutes: number;
    lastSentAt: string; // ISO
  };
  updatedAt: string;
}

export interface IntakeSubmission {
  id: string;
  formId: string;
  formTitle: string;
  client: { name: string; initials: string; phone: string };
  channel: "whatsapp" | "email" | "link";
  status: "completed" | "in-progress" | "pending" | "expired";
  progress: number; // 0-100
  submittedAt?: string;
  sentAt: string;
  flagged?: string[];
}

export const FORMS: IntakeForm[] = [
  {
    id: "f-new-client",
    title: "New Client Intake",
    category: "onboarding",
    status: "live",
    description: "Core intake sent right after a consultation is booked.",
    language: "EN/AR",
    updatedAt: "2026-06-18T10:20:00Z",
    stats: { sent: 142, completed: 128, avgMinutes: 7, lastSentAt: "2026-06-22T08:14:00Z" },
    sections: [
      {
        id: "s1",
        title: "Personal info",
        fields: [
          { id: "f1", label: "Full name", type: "short-text", required: true },
          { id: "f2", label: "Date of birth", type: "date", required: true },
          { id: "f3", label: "Gender", type: "single-choice", required: true, options: ["Female", "Male", "Prefer not to say"] },
          { id: "f4", label: "Phone (WhatsApp)", type: "short-text", required: true },
        ],
      },
      {
        id: "s2",
        title: "Goals & motivation",
        fields: [
          { id: "f5", label: "Primary goal", type: "single-choice", required: true, options: ["Lose weight", "Gain muscle", "Improve health", "Sports performance", "Other"] },
          { id: "f6", label: "Target timeframe", type: "single-choice", options: ["1 month", "3 months", "6 months", "No deadline"] },
          { id: "f7", label: "Why now?", type: "long-text" },
        ],
      },
      {
        id: "s3",
        title: "Lifestyle",
        fields: [
          { id: "f8", label: "Sleep (hours/night)", type: "number" },
          { id: "f9", label: "Stress level", type: "scale" },
          { id: "f10", label: "Activity frequency", type: "single-choice", options: ["Sedentary", "1-2×/week", "3-4×/week", "5+×/week"] },
        ],
      },
    ],
  },
  {
    id: "f-medical",
    title: "Medical History",
    category: "medical",
    status: "live",
    description: "Conditions, medications, allergies — auto-flags red flags.",
    language: "EN",
    updatedAt: "2026-06-12T15:00:00Z",
    stats: { sent: 96, completed: 89, avgMinutes: 6, lastSentAt: "2026-06-21T17:32:00Z" },
    sections: [
      {
        id: "s1",
        title: "Conditions",
        fields: [
          { id: "f1", label: "Diagnosed conditions", type: "multi-choice", options: ["Diabetes", "Hypertension", "PCOS", "Thyroid", "IBS", "None"] },
          { id: "f2", label: "Medications", type: "long-text" },
          { id: "f3", label: "Allergies & intolerances", type: "long-text" },
        ],
      },
      {
        id: "s2",
        title: "Labs",
        fields: [
          { id: "f4", label: "Upload recent blood work", type: "file" },
          { id: "f5", label: "Date of last check-up", type: "date" },
        ],
      },
    ],
  },
  {
    id: "f-food-diary",
    title: "3-Day Food Diary",
    category: "lifestyle",
    status: "live",
    description: "Snapshot of typical eating patterns before plan design.",
    language: "EN/AR",
    updatedAt: "2026-06-05T09:15:00Z",
    stats: { sent: 78, completed: 61, avgMinutes: 12, lastSentAt: "2026-06-20T12:45:00Z" },
    sections: [
      {
        id: "s1",
        title: "Day 1",
        fields: [
          { id: "f1", label: "Breakfast", type: "long-text" },
          { id: "f2", label: "Lunch", type: "long-text" },
          { id: "f3", label: "Dinner", type: "long-text" },
          { id: "f4", label: "Snacks & drinks", type: "long-text" },
        ],
      },
    ],
  },
  {
    id: "f-followup",
    title: "Weekly Check-in",
    category: "follow-up",
    status: "live",
    description: "Quick weight, mood, adherence pulse — sent every Monday.",
    language: "EN",
    updatedAt: "2026-06-15T08:00:00Z",
    stats: { sent: 312, completed: 271, avgMinutes: 2, lastSentAt: "2026-06-22T06:00:00Z" },
    sections: [
      {
        id: "s1",
        title: "Pulse",
        fields: [
          { id: "f1", label: "Current weight (kg)", type: "number", required: true },
          { id: "f2", label: "Adherence this week", type: "scale", required: true },
          { id: "f3", label: "Energy & mood", type: "scale" },
          { id: "f4", label: "Anything to flag?", type: "long-text" },
        ],
      },
    ],
  },
  {
    id: "f-consent",
    title: "Consent & Photo Release",
    category: "consent",
    status: "live",
    description: "Required signature for progress photos and case studies.",
    language: "EN/AR",
    updatedAt: "2026-05-22T11:00:00Z",
    stats: { sent: 134, completed: 130, avgMinutes: 1, lastSentAt: "2026-06-19T14:10:00Z" },
    sections: [
      {
        id: "s1",
        title: "Agreement",
        fields: [
          { id: "f1", label: "I consent to progress tracking", type: "single-choice", required: true, options: ["Yes", "No"] },
          { id: "f2", label: "Signature", type: "signature", required: true },
        ],
      },
    ],
  },
  {
    id: "f-sports",
    title: "Sports Performance Intake",
    category: "onboarding",
    status: "draft",
    description: "Deeper intake for athletes — training load, competitions.",
    language: "EN",
    updatedAt: "2026-06-20T18:30:00Z",
    stats: { sent: 0, completed: 0, avgMinutes: 0, lastSentAt: "" },
    sections: [
      {
        id: "s1",
        title: "Training",
        fields: [
          { id: "f1", label: "Sport", type: "short-text" },
          { id: "f2", label: "Weekly training hours", type: "number" },
          { id: "f3", label: "Next competition", type: "date" },
        ],
      },
    ],
  },
];

export const SUBMISSIONS: IntakeSubmission[] = [
  {
    id: "sub-1",
    formId: "f-new-client",
    formTitle: "New Client Intake",
    client: { name: "Lara Haddad", initials: "LH", phone: "+961 70 112 233" },
    channel: "whatsapp",
    status: "completed",
    progress: 100,
    sentAt: "2026-06-22T08:14:00Z",
    submittedAt: "2026-06-22T08:31:00Z",
    flagged: ["Lactose intolerance"],
  },
  {
    id: "sub-2",
    formId: "f-medical",
    formTitle: "Medical History",
    client: { name: "Omar Khalil", initials: "OK", phone: "+961 71 998 442" },
    channel: "whatsapp",
    status: "in-progress",
    progress: 60,
    sentAt: "2026-06-21T17:32:00Z",
  },
  {
    id: "sub-3",
    formId: "f-followup",
    formTitle: "Weekly Check-in",
    client: { name: "Nadine Aoun", initials: "NA", phone: "+961 76 223 110" },
    channel: "whatsapp",
    status: "completed",
    progress: 100,
    sentAt: "2026-06-22T06:00:00Z",
    submittedAt: "2026-06-22T07:12:00Z",
  },
  {
    id: "sub-4",
    formId: "f-food-diary",
    formTitle: "3-Day Food Diary",
    client: { name: "Rami Saab", initials: "RS", phone: "+961 78 554 091" },
    channel: "email",
    status: "pending",
    progress: 0,
    sentAt: "2026-06-21T10:00:00Z",
  },
  {
    id: "sub-5",
    formId: "f-new-client",
    formTitle: "New Client Intake",
    client: { name: "Yara Mansour", initials: "YM", phone: "+961 79 776 654" },
    channel: "link",
    status: "completed",
    progress: 100,
    sentAt: "2026-06-20T11:20:00Z",
    submittedAt: "2026-06-20T11:39:00Z",
    flagged: ["History of disordered eating"],
  },
  {
    id: "sub-6",
    formId: "f-medical",
    formTitle: "Medical History",
    client: { name: "Tarek Younes", initials: "TY", phone: "+961 70 442 887" },
    channel: "whatsapp",
    status: "expired",
    progress: 20,
    sentAt: "2026-06-14T09:00:00Z",
  },
  {
    id: "sub-7",
    formId: "f-followup",
    formTitle: "Weekly Check-in",
    client: { name: "Sophia Ghanem", initials: "SG", phone: "+961 81 330 220" },
    channel: "whatsapp",
    status: "in-progress",
    progress: 75,
    sentAt: "2026-06-22T06:00:00Z",
  },
  {
    id: "sub-8",
    formId: "f-consent",
    formTitle: "Consent & Photo Release",
    client: { name: "Karim Daou", initials: "KD", phone: "+961 71 008 991" },
    channel: "link",
    status: "completed",
    progress: 100,
    sentAt: "2026-06-19T14:10:00Z",
    submittedAt: "2026-06-19T14:13:00Z",
  },
];

export const CATEGORY_LABEL: Record<IntakeForm["category"], string> = {
  onboarding: "Onboarding",
  medical: "Medical",
  lifestyle: "Lifestyle",
  "follow-up": "Follow-up",
  consent: "Consent",
};

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  "short-text": "Short text",
  "long-text": "Long text",
  number: "Number",
  "single-choice": "Single choice",
  "multi-choice": "Multi choice",
  date: "Date",
  file: "File upload",
  scale: "1–10 scale",
  signature: "Signature",
};
