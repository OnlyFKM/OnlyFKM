import { dataSource } from "@/lib/dataSource";
import { GroupCard } from "@/components/GroupCard";

export default async function GroupsPage() {
  const groups = await dataSource.getGroups();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-mono">Ransomware groups</h1>
        <p className="text-muted text-sm mt-1">
          Tracked threat-actor brands and the number of victims listed on their leak sites.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((g) => (
          <GroupCard key={g.slug} group={g} />
        ))}
      </div>
    </div>
  );
}
