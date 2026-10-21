"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
export default function Login() {
  const router = useRouter();
  const [u, setU] = useState(""), [p, setP] = useState(""), [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const d = await api<{ token: string }>("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
      localStorage.setItem("token", d.token); router.push("/");
    } catch (x) { setErr((x as Error).message); }
  }
  const cls = "w-full rounded border border-slate-700 bg-slate-950 px-3 py-2";
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-xl font-bold">🛡️ SentinelML</h1>
        <p className="text-sm text-slate-400">Sign in to the SOC dashboard</p>
        <input className={cls} placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} />
        <input className={cls} placeholder="Password" type="password" value={p} onChange={(e) => setP(e.target.value)} />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="w-full rounded bg-sky-600 py-2 font-semibold hover:bg-sky-500">Sign in</button>
      </form>
    </main>);
}
