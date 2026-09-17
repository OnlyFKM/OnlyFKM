import type {
  DataSource,
  FilterOptions,
  RansomGroup,
  Stats,
  Victim,
  VictimFilter,
  VictimPage,
} from "@/lib/types";
import { SeedDataSource } from "@/lib/providers/seedProvider";
import { FEED_REVALIDATE_SECONDS } from "@/lib/config";

/**
 * Adapter for a public ransomware-tracking feed (e.g. ransomware.live-style API).
 *
 * IMPORTANT: this was written without live network access to the feed, so the
 * endpoint paths and response shapes below are based on publicly documented
 * conventions and may need adjusting to match the provider's current API
 * before this goes live. Every method falls back to the bundled seed dataset
 * on any request/parse failure, so the app keeps working even if the feed is
 * unreachable, rate-limited, or its schema has drifted.
 */

const BASE_URL = process.env.RANSOM_FEED_BASE_URL ?? "https://api.ransomware.live/v2";

type FeedVictim = {
  victim?: string;
  post_title?: string;
  group_name?: string;
  group?: string;
  country?: string;
  activity?: string;
  sector?: string;
  discovered?: string;
  published?: string;
  website?: string;
  description?: string;
  screenshot?: string;
};

type FeedGroup = {
  name: string;
  description?: string;
  meta?: { since?: string };
  locations?: unknown[];
  is_active?: boolean;
  profile_picture?: string;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeVictim(raw: FeedVictim): Victim | null {
  const name = raw.victim ?? raw.post_title;
  const group = raw.group_name ?? raw.group;
  const discoveredAt = raw.discovered ?? raw.published;
  if (!name || !group || !discoveredAt) return null;

  return {
    id: `${slugify(group)}-${slugify(name)}-${discoveredAt}`,
    name,
    group,
    groupSlug: slugify(group),
    country: raw.country ?? "Unknown",
    sector: raw.sector ?? raw.activity ?? "Unknown",
    discoveredAt,
    website: raw.website,
    description: raw.description,
    screenshotUrl: raw.screenshot,
  };
}

function normalizeGroup(raw: FeedGroup, victimCount: number): RansomGroup {
  return {
    slug: slugify(raw.name),
    name: raw.name,
    description: raw.description,
    firstSeen: raw.meta?.since,
    active: raw.is_active ?? true,
    logoUrl: raw.profile_picture,
    victimCount,
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: FEED_REVALIDATE_SECONDS },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Feed request failed: ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

export class LiveFeedDataSource implements DataSource {
  private fallback = new SeedDataSource();

  async getStats(): Promise<Stats> {
    try {
      const victims = await this.fetchAllVictims();
      const groups = await this.getGroups();
      return this.computeStats(victims, groups);
    } catch {
      return this.fallback.getStats();
    }
  }

  async getVictims(filter: VictimFilter): Promise<VictimPage> {
    try {
      const all = await this.fetchAllVictims();
      return this.applyFilter(all, filter);
    } catch {
      return this.fallback.getVictims(filter);
    }
  }

  async getRecentVictims(limit = 10): Promise<Victim[]> {
    try {
      const raw = await fetchJson<FeedVictim[]>("/recentvictims");
      return raw.map(normalizeVictim).filter((v): v is Victim => v !== null).slice(0, limit);
    } catch {
      return this.fallback.getRecentVictims(limit);
    }
  }

  async getGroups(): Promise<RansomGroup[]> {
    try {
      const [rawGroups, victims] = await Promise.all([
        fetchJson<FeedGroup[]>("/groups"),
        this.fetchAllVictims(),
      ]);
      const countBySlug = new Map<string, number>();
      for (const v of victims) {
        countBySlug.set(v.groupSlug, (countBySlug.get(v.groupSlug) ?? 0) + 1);
      }
      return rawGroups
        .map((g) => normalizeGroup(g, countBySlug.get(slugify(g.name)) ?? 0))
        .sort((a, b) => b.victimCount - a.victimCount);
    } catch {
      return this.fallback.getGroups();
    }
  }

  async getGroup(slug: string): Promise<RansomGroup | null> {
    const groups = await this.getGroups();
    return groups.find((g) => g.slug === slug) ?? null;
  }

  async getVictimsByGroup(slug: string): Promise<Victim[]> {
    try {
      const all = await this.fetchAllVictims();
      return all.filter((v) => v.groupSlug === slug);
    } catch {
      return this.fallback.getVictimsByGroup(slug);
    }
  }

  async getFilterOptions(): Promise<FilterOptions> {
    try {
      const all = await this.fetchAllVictims();
      return {
        countries: [...new Set(all.map((v) => v.country))].sort(),
        sectors: [...new Set(all.map((v) => v.sector))].sort(),
      };
    } catch {
      return this.fallback.getFilterOptions();
    }
  }

  private async fetchAllVictims(): Promise<Victim[]> {
    const raw = await fetchJson<FeedVictim[]>("/recentvictims");
    return raw.map(normalizeVictim).filter((v): v is Victim => v !== null);
  }

  private applyFilter(all: Victim[], filter: VictimFilter): VictimPage {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 25;
    let items = all;
    if (filter.group) items = items.filter((v) => v.groupSlug === filter.group);
    if (filter.country) items = items.filter((v) => v.country === filter.country);
    if (filter.sector) items = items.filter((v) => v.sector === filter.sector);
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
    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  }

  private computeStats(victims: Victim[], groups: RansomGroup[]): Stats {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const victimsLast30Days = victims.filter((v) => new Date(v.discoveredAt) >= cutoff).length;

    const topGroups = groups
      .slice(0, 6)
      .map((g) => ({ group: g.name, groupSlug: g.slug, count: g.victimCount }));

    const countryCounts = new Map<string, number>();
    const sectorCounts = new Map<string, number>();
    const timelineMap = new Map<string, number>();
    for (const v of victims) {
      countryCounts.set(v.country, (countryCounts.get(v.country) ?? 0) + 1);
      sectorCounts.set(v.sector, (sectorCounts.get(v.sector) ?? 0) + 1);
      const day = v.discoveredAt.slice(0, 10);
      timelineMap.set(day, (timelineMap.get(day) ?? 0) + 1);
    }

    const topCountries = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([country, count]) => ({ country, count }));
    const topSectors = [...sectorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([sector, count]) => ({ sector, count }));
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
}
