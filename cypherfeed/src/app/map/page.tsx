import { dataSource } from "@/lib/dataSource";
import { WorldMap } from "@/components/WorldMap";

export default async function MapPage() {
  const countryCounts = await dataSource.getCountryCounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-mono">Map</h1>
        <p className="text-muted text-sm mt-1">
          Victim disclosures by country. Hover a country for its count, click to see its victims.
        </p>
      </div>

      <WorldMap data={countryCounts} />
    </div>
  );
}
