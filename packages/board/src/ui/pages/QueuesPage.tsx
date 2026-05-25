import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

export function QueuesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["queues"],
    queryFn: api.listQueues,
  });

  if (isLoading) return <div className="text-zinc-500">Loading…</div>;
  if (error) return <div className="text-red-400">Error: {String(error)}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {(data ?? []).map((q) => (
        <Link
          key={q.name}
          to={`/queues/${q.name}`}
          className="block rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-600 transition"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold">{q.name}</span>
            {q.paused && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-900 text-amber-200">
                Paused
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Pending" value={q.metrics.pending} />
            <Stat label="Active" value={q.metrics.active} />
            <Stat label="Completed" value={q.metrics.completed} />
            <Stat label="Failed" value={q.metrics.failed} accent="text-red-400" />
            <Stat label="Delayed" value={q.metrics.delayed} />
            <Stat label="Throughput/h" value={q.metrics.throughput} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div className="text-zinc-500 text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-medium ${accent ?? "text-zinc-100"}`}>{value}</div>
    </div>
  );
}
