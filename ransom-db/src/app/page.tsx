import Link from "next/link";
import { dataSource } from "@/lib/dataSource";
import { StatCard } from "@/components/StatCard";
import { TimelineChart } from "@/components/TimelineChart";
import { BarListChart } from "@/components/BarListChart";
import { VictimTable } from "@/components/VictimTable";

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([
    dataSource.getStats(),
    dataSource.getRecentVictims(8),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold font-mono">Ransomware activity dashboard</h1>
        <p className="text-muted text-sm mt-1">
          Publicly disclosed victims tracked across active leak sites.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total victims" value={stats.totalVictims} accent />
        <StatCard label="Tracked groups" value={stats.totalGroups} />
        <StatCard label="Last 30 days" value={stats.victimsLast30Days} />
        <StatCard label="Most active group" value={stats.topGroups[0]?.group ?? "—"} />
      </div>

      <TimelineChart data={stats.timeline} />

      <div className="grid md:grid-cols-3 gap-4">
        <BarListChart
          title="Top groups"
          data={stats.topGroups.map((g) => ({ label: g.group, count: g.count }))}
        />
        <BarListChart
          title="Top countries"
          data={stats.topCountries.map((c) => ({ label: c.country, count: c.count }))}
          color="#f59e0b"
        />
        <BarListChart
          title="Top sectors"
          data={stats.topSectors.map((s) => ({ label: s.sector, count: s.count }))}
          color="#60a5fa"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recently disclosed</h2>
          <Link href="/victims" className="text-sm text-accent hover:underline">
            View all →
          </Link>
        </div>
        <VictimTable victims={recent} />
      </div>
    </div>
  );
}
