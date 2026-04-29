import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-neutral-100">404</h1>
        <p className="mt-4 text-xl text-neutral-400">Page not found</p>
        <Link
          to="/"
          className="mt-8 inline-block rounded bg-accent px-6 py-2 text-neutral-100 transition-colors hover:bg-accent/80"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
