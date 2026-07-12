const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function fetchPageList() {
  const res = await fetch(`${BASE}/api/public/pages`);
  if (!res.ok) throw new Error("Failed to load site navigation");
  const { data } = await res.json();
  return data;
}

/**
 * Fetch a single published page by its slug (e.g. "/" or "/about").
 * Returns null if the page is not found (draft/scheduled/nonexistent all return null).
 */
export async function fetchPage(slug) {
  // Map "/" → "" for the URL path, "/about" → "about", etc.
  const urlSlug = slug === "/" ? "" : slug.replace(/^\//, "");
  const res = await fetch(`${BASE}/api/public/pages/${urlSlug}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load page "${slug}"`);
  const { data } = await res.json();
  return data;
}
