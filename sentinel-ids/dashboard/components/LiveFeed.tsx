import type { FeedItem } from "@/lib/types";
const badge: Record<string, string> = { high: "bg-red-600", medium: "bg-amber-500", low: "bg-yellow-600", none: "bg-slate-700" };
export default function LiveFeed({ items }: { items: FeedItem[] }) {
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-800 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">Live traffic feed</h2>
      <div className="max-h-96 overflow-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-slate-400"><tr><th className="py-1">Time</th><th>Source IP</th><th>Classification</th><th>Severity</th><th>Risk</th></tr></thead>
          <tbody>{items.map((e, i) => (
            <tr key={e.id + i} className="border-t border-slate-800">
              <td className="py-1">{new Date(e.ts).toLocaleTimeString()}</td><td className="font-mono">{e.src_ip}</td>
              <td>{e.label}{e.anomaly && " ⚠"}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-xs ${badge[e.severity]}`}>{e.severity}</span></td>
              <td>{(e.risk * 100).toFixed(0)}%</td></tr>))}</tbody>
        </table>
      </div>
    </div>);
}
