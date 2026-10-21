"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [["/", "Dashboard"], ["/alerts", "Alerts"], ["/model", "Model"], ["/analyze", "Analyze CSV"]];
export default function NavBar() {
  const p = usePathname();
  return (
    <nav className="border-b border-slate-800 bg-slate-900">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
        <span className="mr-4 whitespace-nowrap font-bold">🛡️ SentinelML</span>
        {links.map(([h, l]) => (
          <Link key={h} href={h} className={`whitespace-nowrap rounded px-3 py-1 text-sm ${p === h ? "bg-slate-700" : "text-slate-400 hover:text-white"}`}>{l}</Link>))}
        <button className="ml-auto text-sm text-slate-400 hover:text-white" onClick={() => { localStorage.removeItem("token"); location.href = "/login"; }}>Logout</button>
      </div>
    </nav>);
}
