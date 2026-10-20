"use client";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Totals } from "@/lib/types";
export default function SeverityChart({ totals }: { totals: Totals }) {
  const data = [{ name: "High", v: totals.high, c: "#dc2626" }, { name: "Medium", v: totals.medium, c: "#f59e0b" }, { name: "Low", v: totals.low, c: "#ca8a04" }];
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-800 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">Threat severity breakdown</h2>
      <div className="h-64"><ResponsiveContainer>
        <BarChart data={data}><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
          <Bar dataKey="v" isAnimationActive={false}>{data.map((d) => <Cell key={d.name} fill={d.c} />)}</Bar></BarChart>
      </ResponsiveContainer></div>
    </div>);
}
