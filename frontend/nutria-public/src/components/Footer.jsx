import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-stone-900 text-stone-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">N</span>
          <span className="text-sm font-semibold text-stone-100">Nutria</span>
        </div>
        <p className="text-xs">
          © {new Date().getFullYear()} Nutria. Evidence-based nutrition &amp; training.
        </p>
        <Link
          to="/book"
          className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Book now
        </Link>
      </div>
    </footer>
  );
}
