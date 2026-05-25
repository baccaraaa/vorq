export function WorkersTab({ workers }: { workers: { id: string; running: boolean }[] }) {
  return (
    <table className="w-full text-sm border border-zinc-800 rounded overflow-hidden">
      <thead className="bg-zinc-900 text-zinc-400">
        <tr>
          <th className="text-left px-3 py-2">Worker</th>
          <th className="text-left px-3 py-2">State</th>
        </tr>
      </thead>
      <tbody>
        {workers.map((w) => (
          <tr key={w.id} className="border-t border-zinc-800">
            <td className="px-3 py-2 font-mono">{w.id}</td>
            <td className="px-3 py-2">
              {w.running ? (
                <span className="text-emerald-400">Running</span>
              ) : (
                <span className="text-amber-400">Paused</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
