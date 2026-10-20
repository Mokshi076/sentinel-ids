import type { Tick, Totals } from "@/lib/types";
export default function StatusBanner({ connected, totals, last }: { connected: boolean; totals: Totals; last?: Tick }) {
  const ratio = last && last.total ? last.threats / last.total : 0;
  const level = ratio > 0.3 ? ["CRITICAL", "bg-red-600"] : ratio > 0.1 ? ["ELEVATED", "bg-amber-500"] : ["NORMAL", "bg-emerald-600"];
  const stat = (k: string, v: number, c = "") => (
    <div className="rounded-lg bg-slate-900 border border-slate-800 p-4"><div className="text-xs text-slate-400">{k}</div><div className={`text-2xl font-bold ${c}`}>{v.toLocaleString()}</div></div>);
  return (
    <div className="space-y-3">
      <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${level[1]}`}>
        <span className="font-semibold">THREAT LEVEL: {level[0]}</span>
        <span className="text-sm">{connected ? "● Live" : "○ Disconnected"}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stat("Events analysed", totals.total)}{stat("Threats flagged", totals.threats, "text-red-400")}
        {stat("High severity", totals.high, "text-red-400")}{stat("Medium severity", totals.medium, "text-amber-400")}
      </div>
    </div>);
}
