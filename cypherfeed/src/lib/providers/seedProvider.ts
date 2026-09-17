import type {
  CountryCount,
  DataSource,
  FilterOptions,
  RansomGroup,
  Stats,
  Victim,
  VictimFilter,
  VictimPage,
} from "@/lib/types";
import seedGroups from "@/data/seed-groups.json";
import seedVictims from "@/data/seed-victims.json";

const groups = seedGroups as RansomGroup[];
const victims = seedVictims as Victim[];

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function topN<T extends string>(
  values: T[],
  n: number
): { key: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

export class SeedDataSource implements DataSource {
  async getStats(): Promise<Stats> {
    const cutoff = daysAgo(30);
    const victimsLast30Days = victims.filter(
      (v) => new Date(v.discoveredAt) >= cutoff
    ).length;

    const topGroupsRaw = topN(
      victims.map((v) => v.groupSlug),
      6
    );
    const topGroups = topGroupsRaw.map(({ key, count }) => {
      const g = groups.find((g) => g.slug === key);
      return { group: g?.name ?? key, groupSlug: key, count };
    });

    const topCountries = topN(
      victims.map((v) => v.country),
      8
    ).map(({ key, count }) => ({ country: key, count }));

    const topSectors = topN(
      victims.map((v) => v.sector),
      8
    ).map(({ key, count }) => ({ sector: key, count }));

    const timelineMap = new Map<string, number>();
    for (const v of victims) {
      const day = v.discoveredAt.slice(0, 10);
      timelineMap.set(day, (timelineMap.get(day) ?? 0) + 1);
    }
    const timeline = [...timelineMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, count]) => ({ date, count }));

    return {
      totalVictims: victims.length,
      totalGroups: groups.length,
      victimsLast30Days,
      topGroups,
      topCountries,
      topSectors,
      timeline,
    };
  }

  async getVictims(filter: VictimFilter): Promise<VictimPage> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 25;

    let items = victims;
    if (filter.group) {
      items = items.filter((v) => v.groupSlug === filter.group);
    }
    if (filter.country) {
      items = items.filter((v) => v.country === filter.country);
    }
    if (filter.sector) {
      items = items.filter((v) => v.sector === filter.sector);
    }
    if (filter.query) {
      const q = filter.query.toLowerCase();
      items = items.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.group.toLowerCase().includes(q) ||
          v.sector.toLowerCase().includes(q) ||
          v.country.toLowerCase().includes(q)
      );
    }

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return { items: paged, total, page, pageSize };
  }

  async getRecentVictims(limit = 10): Promise<Victim[]> {
    return victims.slice(0, limit);
  }

  async getGroups(): Promise<RansomGroup[]> {
    return [...groups].sort((a, b) => b.victimCount - a.victimCount);
  }

  async getGroup(slug: string): Promise<RansomGroup | null> {
    return groups.find((g) => g.slug === slug) ?? null;
  }

  async getVictimsByGroup(slug: string): Promise<Victim[]> {
    return victims.filter((v) => v.groupSlug === slug);
  }

  async getFilterOptions(): Promise<FilterOptions> {
    return {
      countries: [...new Set(victims.map((v) => v.country))].sort(),
      sectors: [...new Set(victims.map((v) => v.sector))].sort(),
    };
  }

  async getCountryCounts(): Promise<CountryCount[]> {
    return topN(
      victims.map((v) => v.country),
      Number.POSITIVE_INFINITY
    ).map(({ key, count }) => ({ country: key, count }));
  }
}
