import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { DlqTab } from "./DlqTab.js";
import { TasksTab } from "./TasksTab.js";
import { WorkersTab } from "./WorkersTab.js";

type Tab = "tasks" | "dlq" | "workers";

export function QueueDetailPage() {
  const { name } = useParams<{ name: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("tasks");

  const { data } = useQuery({
    queryKey: ["queue", name],
    queryFn: () => api.getQueue(name as string),
    enabled: !!name,
  });

  const pause = useMutation({
    mutationFn: () => api.pauseQueue(name as string),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue", name] }),
  });
  const resume = useMutation({
    mutationFn: () => api.resumeQueue(name as string),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue", name] }),
  });

  if (!name || !data) return <div className="text-zinc-500">Loading…</div>;

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <div className="space-x-2">
          {data.paused ? (
            <button
              type="button"
              onClick={() => resume.mutate()}
              className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={() => pause.mutate()}
              className="px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-sm"
            >
              Pause
            </button>
          )}
        </div>
      </header>
      <nav className="flex gap-1 border-b border-zinc-800 mb-4">
        {(["tasks", "dlq", "workers"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm ${
              tab === t
                ? "border-b-2 border-zinc-100 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </nav>
      {tab === "tasks" && <TasksTab queue={name} />}
      {tab === "dlq" && <DlqTab queue={name} />}
      {tab === "workers" && <WorkersTab workers={data.workers} />}
    </div>
  );
}
