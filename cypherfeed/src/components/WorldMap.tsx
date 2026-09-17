"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import worldTopologyJson from "world-atlas/countries-110m.json";
import type { GeoJsonObject } from "geojson";
import { toMapCountryName } from "@/lib/countryNameAliases";
import type { CountryCount } from "@/lib/types";

// react-simple-maps accepts a topojson Topology at runtime (it detects
// `type === "Topology"` and converts it internally), but its published types
// only declare GeoJsonObject — hence the cast.
const worldTopology = worldTopologyJson as unknown as GeoJsonObject;

const NO_DATA_FILL = "#171c25";
const MIN_FILL = "#3a1414";
const MAX_FILL = "#ef4444";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

type Tooltip = { name: string; count: number; x: number; y: number };

export function WorldMap({ data }: { data: CountryCount[] }) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const { byMapName, maxCount } = useMemo(() => {
    const map = new Map<string, CountryCount>();
    let max = 0;
    for (const entry of data) {
      map.set(toMapCountryName(entry.country), entry);
      if (entry.count > max) max = entry.count;
    }
    return { byMapName: map, maxCount: max };
  }, [data]);

  function fillFor(count: number): string {
    if (count === 0 || maxCount === 0) return NO_DATA_FILL;
    // Square-root scale so a handful of heavily-hit countries don't wash out
    // everything else on the map.
    const t = Math.sqrt(count / maxCount);
    return mix(hexToRgb(MIN_FILL), hexToRgb(MAX_FILL), t);
  }

  return (
    <div className="relative rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted mb-2">
        Victims by country
      </p>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155 }}
        width={800}
        height={420}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={worldTopology}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const geoName = (geo.properties?.name as string | undefined) ?? "Unknown";
              const entry = byMapName.get(geoName);
              const isHovered = hoveredKey === geo.rsmKey;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHovered && entry ? "#f59e0b" : fillFor(entry?.count ?? 0)}
                  stroke="#232a35"
                  strokeWidth={0.5}
                  style={{ outline: "none", cursor: entry ? "pointer" : "default" }}
                  onMouseEnter={(evt) => {
                    setHoveredKey(geo.rsmKey);
                    setTooltip({
                      name: entry?.country ?? geoName,
                      count: entry?.count ?? 0,
                      x: evt.clientX,
                      y: evt.clientY,
                    });
                  }}
                  onMouseMove={(evt) => {
                    setTooltip((prev) =>
                      prev ? { ...prev, x: evt.clientX, y: evt.clientY } : prev
                    );
                  }}
                  onMouseLeave={() => {
                    setHoveredKey(null);
                    setTooltip(null);
                  }}
                  onClick={() => {
                    if (entry) {
                      router.push(`/victims?country=${encodeURIComponent(entry.country)}`);
                    }
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      <div className="flex items-center gap-2 mt-2 text-xs text-muted">
        <span>Fewer</span>
        <div
          className="h-2 flex-1 max-w-40 rounded-full"
          style={{ background: `linear-gradient(to right, ${MIN_FILL}, ${MAX_FILL})` }}
        />
        <span>More</span>
      </div>

      {tooltip && (
        <div
          className="fixed z-20 pointer-events-none rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="font-medium">{tooltip.name}</p>
          <p className="text-muted font-mono">
            {tooltip.count} victim{tooltip.count === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}
