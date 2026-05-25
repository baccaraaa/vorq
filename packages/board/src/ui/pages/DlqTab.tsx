import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function DlqTab({ queue }: { queue: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["dlq", queue], queryFn: () => api.listDlq(queue) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["dlq", queue] });
  const retry = useMutation({
    mutationFn: (id: string) => api.retryDlq(queue, id),
    onSuccess: invalidate,
  });
  const retryAll = useMutation({
    mutationFn: () => api.retryAllDlq(queue),
    onSuccess: invalidate,
  });
  const purge = useMutation({ mutationFn: () => api.purgeDlq(queue), onSuccess: invalidate });

  return (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <button
          type="button"
          onClick={() => retryAll.mutate()}
          className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-sm"
        >
          Retry all
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Purge DLQ?")) purge.mutate();
          }}
          className="px-3 py-1.5 rounded bg-red-800 hover:bg-red-700 text-sm"
        >
          Purge
        </button>
      </div>
      <table className="w-full text-sm border border-zinc-800 rounded overflow-hidden">
        <thead className="bg-zinc-900 text-zinc-400">
          <tr>
            <th className="text-left px-3 py-2">Task ID</th>
            <th className="text-left px-3 py-2">Error</th>
            <th className="text-left px-3 py-2">Attempts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((e) => (
            <tr key={e.taskId} className="border-t border-zinc-800">
              <td className="px-3 py-2 font-mono text-xs">{e.taskId.slice(0, 16)}…</td>
              <td className="px-3 py-2 text-red-300 truncate max-w-xs">{e.error}</td>
              <td className="px-3 py-2">{e.attempts}</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => retry.mutate(e.taskId)}
                  className="text-emerald-400 hover:text-emerald-300 text-xs"
                >
                  Retry
                </button>
              </td>
            </tr>
          ))}
          {(data ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                DLQ is empty
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
