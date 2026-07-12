// CMS mock data — Pages tab now served by the real API (cms-api.ts).
// This file retains mock data for Blog, Services, and Testimonials tabs
// which are not yet built on the backend.
//
// Types for the Pages tab live in cms-api.ts — import from there, not here.

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: "published" | "draft" | "scheduled";
  publishedAt?: string;
  author: string;
  category: string;
  readMin: number;
  views: number;
}

export interface ServiceCard {
  id: string;
  name: string;
  blurb: string;
  priceFrom: number;
  active: boolean;
  bookings30d: number;
}

export interface Testimonial {
  id: string;
  client: string;
  quote: string;
  rating: number;
  published: boolean;
}

export interface SiteStats {
  visitors30d: number;
  visitorsDelta: number;
  bookings30d: number;
  bookingsDelta: number;
  conversionRate: number;
  domain: string;
  ssl: "active" | "pending";
  lastDeploy: string;
}

// views30d and all analytics stats are hardcoded mock values — no real analytics
// integration exists yet. TODO: wire to a real analytics source (Plausible, GA4, etc.)
export const SITE_STATS: SiteStats = {
  visitors30d: 4820,
  visitorsDelta: 12.4,
  bookings30d: 64,
  bookingsDelta: 8.1,
  conversionRate: 1.3,
  domain: "nutria.health",
  ssl: "active",
  lastDeploy: "2026-06-21T08:42:00Z",
};

export const BLOG_POSTS: BlogPost[] = [
  {
    id: "b1",
    title: "How to read food labels in 60 seconds",
    slug: "read-food-labels",
    excerpt: "A quick visual guide to spotting sugars, hidden sodium and serving traps.",
    status: "published",
    publishedAt: "2026-06-18",
    author: "Sura Hawli",
    category: "Nutrition basics",
    readMin: 4,
    views: 1240,
  },
  {
    id: "b2",
    title: "Protein at every meal — does it actually matter?",
    slug: "protein-every-meal",
    excerpt: "The science behind protein timing and what we recommend to clients.",
    status: "published",
    publishedAt: "2026-06-10",
    author: "Sura Hawli",
    category: "Science",
    readMin: 6,
    views: 980,
  },
  {
    id: "b3",
    title: "5 lunchbox ideas for working parents",
    slug: "lunchbox-ideas",
    excerpt: "Quick, balanced and cheap. Tested with our family clients.",
    status: "published",
    publishedAt: "2026-06-03",
    author: "Rana Eid",
    category: "Meal ideas",
    readMin: 3,
    views: 620,
  },
  {
    id: "b4",
    title: "PCOS-friendly breakfast bowls",
    slug: "pcos-breakfast",
    excerpt: "Low-GI, high-fibre combos that won't spike your morning.",
    status: "draft",
    author: "Sura Hawli",
    category: "Clinical",
    readMin: 5,
    views: 0,
  },
  {
    id: "b5",
    title: "Hydration: how much water do you really need?",
    slug: "hydration-guide",
    excerpt: "Forget 8 glasses — here's a personalised formula.",
    status: "scheduled",
    publishedAt: "2026-06-25",
    author: "Sura Hawli",
    category: "Nutrition basics",
    readMin: 4,
    views: 0,
  },
];

export const SERVICES: ServiceCard[] = [
  {
    id: "s1",
    name: "Initial consultation",
    blurb: "60-minute deep-dive: history, goals, lab review.",
    priceFrom: 89,
    active: true,
    bookings30d: 24,
  },
  {
    id: "s2",
    name: "Diet package — monthly",
    blurb: "Personalised meal plan + weekly check-ins.",
    priceFrom: 149,
    active: true,
    bookings30d: 18,
  },
  {
    id: "s3",
    name: "Diet + Gym programming",
    blurb: "Combined nutrition and training, weekly 1:1.",
    priceFrom: 249,
    active: true,
    bookings30d: 12,
  },
  {
    id: "s4",
    name: "Clinical / PCOS plan",
    blurb: "Evidence-based plan with lab-driven adjustments.",
    priceFrom: 199,
    active: true,
    bookings30d: 6,
  },
  {
    id: "s5",
    name: "Ramadan plan",
    blurb: "Seasonal package — suhoor, iftar and hydration.",
    priceFrom: 99,
    active: false,
    bookings30d: 0,
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    client: "Sara E.",
    quote: "Lost 8 kg in 3 months without ever feeling hungry. Sura actually listens.",
    rating: 5,
    published: true,
  },
  {
    id: "t2",
    client: "Youssef B.",
    quote: "Finally a coach who pairs nutrition with my training. Numbers don't lie.",
    rating: 5,
    published: true,
  },
  {
    id: "t3",
    client: "Imane T.",
    quote: "The weekly check-ins kept me accountable. Worth every dirham.",
    rating: 5,
    published: true,
  },
  {
    id: "t4",
    client: "Karim I.",
    quote: "Realistic plans, fast replies on WhatsApp. Recommended.",
    rating: 4,
    published: false,
  },
];

const BLOG_STATUS_STYLES: Record<
  "published" | "draft" | "scheduled",
  { label: string; cls: string }
> = {
  published: {
    label: "Published",
    cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  draft: { label: "Draft", cls: "bg-slate-500/10  text-slate-700  border-slate-500/20" },
  scheduled: { label: "Scheduled", cls: "bg-amber-500/10  text-amber-700  border-amber-500/20" },
};
export { BLOG_STATUS_STYLES as STATUS_STYLES };

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
