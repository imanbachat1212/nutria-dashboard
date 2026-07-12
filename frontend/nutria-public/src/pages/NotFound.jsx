import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-7xl font-extrabold text-stone-200">404</span>
      <h1 className="text-2xl font-bold text-stone-900">Page not found</h1>
      <p className="text-stone-500 text-sm max-w-xs">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
      >
        Go to Home
      </Link>
    </div>
  );
}
