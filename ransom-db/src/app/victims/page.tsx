import { dataSource } from "@/lib/dataSource";
import { Filters } from "@/components/Filters";
import { VictimTable } from "@/components/VictimTable";
import { Pagination } from "@/components/Pagination";

type SearchParams = Promise<{
  q?: string;
  group?: string;
  country?: string;
  sector?: string;
  page?: string;
}>;

export default async function VictimsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const [{ items, total, pageSize }, groups, stats] = await Promise.all([
    dataSource.getVictims({
      query: sp.q,
      group: sp.group,
      country: sp.country,
      sector: sp.sector,
      page,
      pageSize: 25,
    }),
    dataSource.getGroups(),
    dataSource.getStats(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-mono">Victims</h1>
        <p className="text-muted text-sm mt-1">
          Browse and filter publicly disclosed ransomware victim listings.
        </p>
      </div>

      <Filters
        groups={groups.map((g) => ({ slug: g.slug, name: g.name }))}
        countries={stats.topCountries.map((c) => c.country)}
        sectors={stats.topSectors.map((s) => s.sector)}
      />

      <VictimTable victims={items} />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/victims"
        searchParams={sp}
      />
    </div>
  );
}
