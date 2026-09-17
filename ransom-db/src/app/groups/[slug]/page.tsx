import { notFound } from "next/navigation";
import { dataSource } from "@/lib/dataSource";
import { VictimTable } from "@/components/VictimTable";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await dataSource.getGroup(slug);
  if (!group) notFound();

  const victims = await dataSource.getVictimsByGroup(slug);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-mono">{group.name}</h1>
          {group.description && (
            <p className="text-muted text-sm mt-1 max-w-2xl">{group.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 text-xs uppercase tracking-wide px-2 py-1 rounded-full border ${
            group.active ? "border-accent/40 text-accent" : "border-border text-muted"
          }`}
        >
          {group.active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="flex gap-6 text-sm text-muted font-mono">
        <span>{group.victimCount} listed victims</span>
        {group.firstSeen && <span>Tracked since {group.firstSeen}</span>}
      </div>

      <VictimTable victims={victims} />
    </div>
  );
}
