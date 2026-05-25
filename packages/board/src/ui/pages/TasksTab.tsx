import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client.js";

export function TasksTab({ queue }: { queue: string }) {
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["tasks", queue, status, search],
    queryFn: () =>
      api.listTasks(queue, {
        status: status || undefined,
        limit: 100,
        search: search || undefined,
      }),
  });

  const detail = useQuery({
    queryKey: ["task", queue, selected],
    queryFn: () => api.getTask(queue, selected as string),
    enabled: !!selected,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <div className="flex gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task id…"
            className="flex-1 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-sm"
          >
            <option value="">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="ABANDONED">Dead-lettered</option>
          </select>
        </div>
        <table className="w-full text-sm border border-zinc-800 rounded overflow-hidden">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="text-left px-3 py-2">Task ID</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Attempt</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((t) => (
              <tr
                key={t.taskId}
                onClick={() => setSelected(t.taskId)}
                className={`border-t border-zinc-800 cursor-pointer hover:bg-zinc-900 ${
                  selected === t.taskId ? "bg-zinc-900" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs">{t.taskId.slice(0, 12)}…</td>
                <td className="px-3 py-2">
                  <Badge status={t.status} />
                </td>
                <td className="px-3 py-2">{t.attempt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="border border-zinc-800 rounded p-4 bg-zinc-900 text-sm">
        {!selected && <div className="text-zinc-500">Select a task to view details</div>}
        {detail.data && (
          <div className="space-y-3">
            <div>
              <div className="text-zinc-500 text-xs uppercase">Task ID</div>
              <div className="font-mono break-all">{detail.data.taskId}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs uppercase">Status</div>
              <Badge status={detail.data.status} />
            </div>
            <div>
              <div className="text-zinc-500 text-xs uppercase">Attempt</div>
              <div>{detail.data.attempt}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs uppercase">Payload</div>
              <pre className="bg-zinc-950 p-2 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(detail.data.payload, null, 2)}
              </pre>
            </div>
            {detail.data.result !== undefined && (
              <div>
                <div className="text-zinc-500 text-xs uppercase">Result</div>
                <pre className="bg-zinc-950 p-2 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(detail.data.result, null, 2)}
                </pre>
              </div>
            )}
            {detail.data.error && (
              <div>
                <div className="text-zinc-500 text-xs uppercase">Error</div>
                <pre className="bg-red-950/40 p-2 rounded text-xs text-red-300 whitespace-pre-wrap">
                  {detail.data.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: "bg-emerald-900 text-emerald-200",
    ACTIVE: "bg-blue-900 text-blue-200",
    QUEUED: "bg-zinc-800 text-zinc-200",
    FAILED: "bg-red-900 text-red-200",
    ABANDONED: "bg-red-950 text-red-300",
    RETRYING: "bg-amber-900 text-amber-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[status] ?? "bg-zinc-800 text-zinc-200"}`}>
      {status}
    </span>
  );
}
