"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
export default function TrafficChart({ ticks, title = "Traffic volume vs threats (per second)" }: { ticks: { ts: number; total: number; threats: number }[]; title?: string }) {
  const data = ticks.map((t) => ({ time: new Date(t.ts).toLocaleTimeString(), traffic: t.total, threats: t.threats }));
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-800 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">{title}</h2>
      <div className="h-64"><ResponsiveContainer>
        <AreaChart data={data}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="time" hide /><YAxis stroke="#64748b" />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
          <Area dataKey="traffic" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} isAnimationActive={false} />
          <Area dataKey="threats" stroke="#f87171" fill="#f87171" fillOpacity={0.4} isAnimationActive={false} /></AreaChart>
      </ResponsiveContainer></div>
    </div>);
}
