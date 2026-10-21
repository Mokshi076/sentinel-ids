"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
interface Rep { source: string; rows: number; test_rows: number; labels: string[]; report: Record<string, any>; confusion: number[][]; importances: [string, number][] }
export default function Model() {
  const [r, setR] = useState<Rep | null>(null), [err, setErr] = useState("");
  useEffect(() => { api<Rep>("/api/model-report").then(setR).catch((e) => setErr(e.message)); }, []);
  if (err) return <main className="p-4 text-red-400">{err}</main>;
  if (!r) return <main className="p-4">Loading…</main>;
  const f = (x: number) => x.toFixed(3), mx = Math.max(...r.importances.map((i) => i[1]));
  const card = (k: string, v: string) => <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-400">{k}</div><div className="text-2xl font-bold">{v}</div></div>;
  const box = "rounded-lg border border-slate-800 bg-slate-900 p-4";
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Model performance <span className="text-sm font-normal text-slate-400">(XGBoost, held-out test set)</span></h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card("Accuracy", f(r.report.accuracy))}{card("Macro F1", f(r.report["macro avg"]["f1-score"]))}
        {card("Macro recall", f(r.report["macro avg"]["recall"]))}{card("Rows used", r.rows.toLocaleString())}
      </div>
      <p className="text-xs text-slate-400">Trained on: {r.source} · {r.test_rows.toLocaleString()} test rows</p>
      <div className={`${box} overflow-x-auto`}>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Per-class metrics</h2>
        <table className="w-full min-w-[420px] text-sm"><thead className="text-left text-slate-400"><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr></thead>
          <tbody>{r.labels.map((l) => (<tr key={l} className="border-t border-slate-800"><td className="py-1">{l}</td><td>{f(r.report[l].precision)}</td><td>{f(r.report[l].recall)}</td><td>{f(r.report[l]["f1-score"])}</td><td>{r.report[l].support}</td></tr>))}</tbody></table>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${box} overflow-x-auto`}>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Confusion matrix (rows = actual, columns = predicted)</h2>
          <div className="grid gap-1 text-xs" style={{ gridTemplateColumns: `auto repeat(${r.labels.length}, minmax(52px, 1fr))` }}>
            <div />{r.labels.map((l) => <div key={l} className="text-center text-slate-400">{l}</div>)}
            {r.confusion.map((row, i) => { const t = row.reduce((a, b) => a + b, 0) || 1; return [
              <div key={"l" + i} className="pr-2 text-slate-400">{r.labels[i]}</div>,
              ...row.map((v, j) => <div key={i + "-" + j} className="rounded py-2 text-center" style={{ background: `rgba(56,189,248,${0.08 + 0.85 * (v / t)})` }}>{v}</div>)]; })}
          </div>
        </div>
        <div className={box}>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Top feature importances</h2>
          {r.importances.map(([n, v]) => (<div key={n} className="my-1 flex items-center gap-2 text-xs"><span className="w-40 truncate text-slate-400">{n}</span>
            <div className="h-2 rounded bg-sky-500" style={{ width: `${(v / mx) * 60}%` }} /><span>{v.toFixed(3)}</span></div>))}
        </div>
      </div>
    </main>);
}
