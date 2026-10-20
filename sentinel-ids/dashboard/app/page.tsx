"use client";
import { useStream } from "@/hooks/useStream";
import StatusBanner from "@/components/StatusBanner";
import LiveFeed from "@/components/LiveFeed";
import TrafficChart from "@/components/TrafficChart";
import SeverityChart from "@/components/SeverityChart";

export default function Page() {
  const { connected, ticks, feed, totals } = useStream();
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <h1 className="text-xl font-bold">🛡️ SentinelML <span className="text-slate-400 font-normal">Security Operations Center</span></h1>
      <StatusBanner connected={connected} totals={totals} last={ticks[ticks.length - 1]} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><TrafficChart ticks={ticks} /></div>
        <SeverityChart totals={totals} />
      </div>
      <LiveFeed items={feed} />
    </main>
  );
}
