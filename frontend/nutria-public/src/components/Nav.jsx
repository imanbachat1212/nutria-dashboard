import { Link, useLocation } from "react-router-dom";
import { useLang } from "../App.jsx";

// Map slug → display label used in nav
const NAV_LABELS = {
  "/":        "Home",
  "/about":   "About",
  "/services":"Services",
  "/book":    "Book",
};

// Slugs that appear in the primary nav (in order)
const NAV_ORDER = ["/", "/about", "/services", "/book"];

export default function Nav({ pages }) {
  const { lang, setLang } = useLang();
  const { pathname } = useLocation();

  const ordered = NAV_ORDER
    .map((slug) => pages.find((p) => p.slug === slug))
    .filter(Boolean);

  // Slug → URL path
  const toPath = (slug) => (slug === "/" ? "/" : slug);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white text-sm font-bold">N</span>
          <span className="text-lg tracking-tight">Nutria</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden items-center gap-1 sm:flex">
          {ordered.map((page) => {
            const path = toPath(page.slug);
            const active = pathname === path || (path !== "/" && pathname.startsWith(path));
            return (
              <Link
                key={page.slug}
                to={path}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                {NAV_LABELS[page.slug] ?? page.title}
              </Link>
            );
          })}
        </nav>

        {/* Language toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang("en")}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
              lang === "en"
                ? "bg-brand-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang("ar")}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
              lang === "ar"
                ? "bg-brand-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            عر
          </button>
        </div>
      </div>
    </header>
  );
}
