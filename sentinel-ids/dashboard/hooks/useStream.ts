"use client";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { FeedItem, Tick, Totals } from "@/lib/types";

export function useStream() {
  const [connected, setConnected] = useState(false);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [totals, setTotals] = useState<Totals>({ total: 0, threats: 0, high: 0, medium: 0, low: 0 });

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3001", { auth: { token: localStorage.getItem("token") } });
    s.on("connect_error", (e) => { if (e.message === "unauthorized") { localStorage.removeItem("token"); location.href = "/login"; } });
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("tick", (t: Tick) => {
      setTicks((p) => [...p.slice(-59), t]);
      setFeed((p) => [...t.feed, ...p].slice(0, 40));
      setTotals((p) => ({ total: p.total + t.total, threats: p.threats + t.threats,
        high: p.high + t.bySeverity.high, medium: p.medium + t.bySeverity.medium, low: p.low + t.bySeverity.low }));
    });
    return () => { s.close(); };
  }, []);
  return { connected, ticks, feed, totals };
}
