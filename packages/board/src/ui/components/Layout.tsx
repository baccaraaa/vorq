import { Link, Outlet } from "react-router-dom";
import { useSse } from "../hooks/use-sse.js";

export function Layout() {
  useSse();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-semibold tracking-tight">
          Vorq Board
        </Link>
        <nav className="text-sm text-zinc-400 space-x-4">
          <Link to="/" className="hover:text-zinc-200">
            Queues
          </Link>
          <Link to="/schedules" className="hover:text-zinc-200">
            Schedules
          </Link>
        </nav>
      </header>
      <main className="px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
