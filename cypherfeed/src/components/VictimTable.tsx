import Link from "next/link";
import type { Victim } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function VictimTable({ victims }: { victims: Victim[] }) {
  if (victims.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center text-muted text-sm">
        No entries match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Victim</th>
            <th className="px-4 py-3 font-medium">Group</th>
            <th className="px-4 py-3 font-medium">Sector</th>
            <th className="px-4 py-3 font-medium">Country</th>
            <th className="px-4 py-3 font-medium">Disclosed</th>
          </tr>
        </thead>
        <tbody>
          {victims.map((v) => (
            <tr key={v.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
              <td className="px-4 py-3 font-medium">{v.name}</td>
              <td className="px-4 py-3">
                <Link href={`/groups/${v.groupSlug}`} className="text-accent hover:underline">
                  {v.group}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted">{v.sector}</td>
              <td className="px-4 py-3 text-muted">{v.country}</td>
              <td className="px-4 py-3 text-muted font-mono text-xs">{formatDate(v.discoveredAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
