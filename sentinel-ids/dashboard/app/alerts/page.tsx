"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import TrafficChart from "@/components/TrafficChart";
interface Row { ts: string; src_ip: string; label: string; risk: number; severity: string; anomaly: boolean }
interface Hist { t: string; total: number; threats: number }
const badge: Record<string, string> = { high: "bg-red-600", medium: "bg-amber-500", low: "bg-yellow-600" };
export default function Alerts() {
  const [rows, setRows] = useState<Row[]>([]), [hist, setHist] = useState<Hist[]>([]);
  const [sev, setSev] = useState(""), [label, setLabel] = useState(""), [q, setQ] = useState(""), [page, setPage] = useState(0), [err, setErr] = useState("");
  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ limit: "25", offset: String(page * 25) });
      if (sev) p.set("severity", sev); if (label) p.set("label", label); if (q) p.set("q", q);
      setRows(await api<Row[]>("/api/alerts?" + p)); setHist(await api<Hist[]>("/api/history?minutes=30")); setErr("");
    } catch (e) { setErr((e as Error).message); }
  }, [sev, label, q, page]);
  useEffect(() => { load(); }, [load]);
  const inp = "rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm";
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Alert history</h1>
      <TrafficChart title="Events vs threats (per 10 s, last 30 min)" ticks={hist.map((h) => ({ ts: new Date(h.t).getTime(), total: h.total, threats: h.threats }))} />
      <div className="flex flex-wrap gap-2">
        <select className={inp} value={sev} onChange={(e) => { setSev(e.target.value); setPage(0); }}>
          <option value="">All severities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <input className={inp} placeholder="Attack type (exact)" value={label} onChange={(e) => { setLabel(e.target.value); setPage(0); }} />
        <input className={inp} placeholder="Search IP" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <button className={inp} onClick={load}>Refresh</button>
      </div>
      {err && <p className="text-red-400">{err}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-4">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-slate-400"><tr><th>Time</th><th>Source IP</th><th>Type</th><th>Severity</th><th>Risk</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-800"><td className="py-1">{new Date(r.ts).toLocaleString()}</td><td className="font-mono">{r.src_ip}</td>
              <td>{r.label}</td><td><span className={`rounded-full px-2 py-0.5 text-xs ${badge[r.severity]}`}>{r.severity}</span></td><td>{(r.risk * 100).toFixed(0)}%</td></tr>))}</tbody>
        </table>
        {!rows.length && !err && <p className="py-4 text-slate-400">No alerts match.</p>}
      </div>
      <div className="flex gap-2">
        <button className={inp} disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
        <span className="py-1 text-sm text-slate-400">Page {page + 1}</span>
        <button className={inp} disabled={rows.length < 25} onClick={() => setPage(page + 1)}>Next →</button>
      </div>
    </main>);
}
