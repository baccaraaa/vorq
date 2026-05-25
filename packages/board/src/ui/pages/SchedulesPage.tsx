import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function SchedulesPage() {
  const { data } = useQuery({ queryKey: ["schedules"], queryFn: api.listSchedules });
  return (
    <table className="w-full text-sm border border-zinc-800 rounded overflow-hidden">
      <thead className="bg-zinc-900 text-zinc-400">
        <tr>
          <th className="text-left px-3 py-2">Queue</th>
          <th className="text-left px-3 py-2">Cron</th>
          <th className="text-left px-3 py-2">Next run</th>
        </tr>
      </thead>
      <tbody>
        {(data ?? []).map((s) => (
          <tr key={s.id} className="border-t border-zinc-800">
            <td className="px-3 py-2">{s.queue}</td>
            <td className="px-3 py-2 font-mono">{s.cron}</td>
            <td className="px-3 py-2">{new Date(s.nextRun).toLocaleString()}</td>
          </tr>
        ))}
        {(data ?? []).length === 0 && (
          <tr>
            <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
              No schedules
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
