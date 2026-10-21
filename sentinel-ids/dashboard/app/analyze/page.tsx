"use client";
import { useState } from "react";
import { api } from "@/lib/api";
interface Res { rows: number; missing_features: string[]; byLabel: Record<string, number>; bySeverity: Record<string, number>; flagged: { row: number; label: string; risk: number; severity: string }[]; accuracy?: number }
export default function Analyze() {
  const [res, setRes] = useState<Res | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function onFile(f: File) {
    setBusy(true); setErr(""); setRes(null);
    try { setRes(await api<Res>("/api/analyze", { method: "POST", headers: { "Content-Type": "text/csv" }, body: await f.text() })); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  const box = "rounded-lg border border-slate-800 bg-slate-900 p-4";
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Analyze a CSV</h1>
      <div className={box}>
        <input type="file" accept=".csv" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <p className="mt-2 text-xs text-slate-400">Network-flow CSV with the model's feature columns (an optional Label column gives accuracy). Max 30 MB; the first 20,000 rows are scored.</p>
        {busy && <p className="mt-2 text-sky-400">Analyzing…</p>}{err && <p className="mt-2 text-red-400">{err}</p>}
      </div>
      {res && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className={box}><div className="text-xs text-slate-400">Rows scored</div><div className="text-2xl font-bold">{res.rows.toLocaleString()}</div></div>
          <div className={box}><div className="text-xs text-slate-400">Threats</div><div className="text-2xl font-bold text-red-400">{res.rows - (res.bySeverity.none || 0)}</div></div>
          {res.accuracy !== undefined && <div className={box}><div className="text-xs text-slate-400">Accuracy vs Label</div><div className="text-2xl font-bold">{(res.accuracy * 100).toFixed(1)}%</div></div>}
        </div>
        {res.missing_features.length > 0 && <p className="text-sm text-amber-400">Missing columns (filled automatically): {res.missing_features.join(", ")}</p>}
        <div className={box}><h2 className="mb-2 text-sm font-semibold text-slate-300">Classification counts</h2>
          {Object.entries(res.byLabel).map(([k, v]) => <div key={k} className="flex justify-between border-t border-slate-800 py-1 text-sm"><span>{k}</span><span>{v.toLocaleString()}</span></div>)}</div>
        <div className={`${box} max-h-96 overflow-auto`}><h2 className="mb-2 text-sm font-semibold text-slate-300">Top flagged rows</h2>
          <table className="w-full text-sm"><thead className="text-left text-slate-400"><tr><th>Row</th><th>Type</th><th>Severity</th><th>Risk</th></tr></thead>
            <tbody>{res.flagged.map((x) => <tr key={x.row} className="border-t border-slate-800"><td className="py-1">{x.row + 1}</td><td>{x.label}</td><td>{x.severity}</td><td>{(x.risk * 100).toFixed(0)}%</td></tr>)}</tbody></table></div>
      </>}
    </main>);
}
