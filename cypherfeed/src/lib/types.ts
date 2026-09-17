export type Victim = {
  id: string;
  name: string;
  group: string;
  groupSlug: string;
  country: string;
  sector: string;
  discoveredAt: string; // ISO date
  website?: string;
  description?: string;
  screenshotUrl?: string;
};

export type RansomGroup = {
  slug: string;
  name: string;
  description?: string;
  firstSeen?: string; // ISO date
  active: boolean;
  logoUrl?: string;
  victimCount: number;
};

export type Stats = {
  totalVictims: number;
  totalGroups: number;
  victimsLast30Days: number;
  topGroups: { group: string; groupSlug: string; count: number }[];
  topCountries: { country: string; count: number }[];
  topSectors: { sector: string; count: number }[];
  timeline: { date: string; count: number }[];
};

export type VictimFilter = {
  query?: string;
  group?: string;
  country?: string;
  sector?: string;
  page?: number;
  pageSize?: number;
};

export type VictimPage = {
  items: Victim[];
  total: number;
  page: number;
  pageSize: number;
};

export type FilterOptions = {
  countries: string[];
  sectors: string[];
};

export type CountryCount = { country: string; count: number };

export interface DataSource {
  getStats(): Promise<Stats>;
  getVictims(filter: VictimFilter): Promise<VictimPage>;
  getRecentVictims(limit?: number): Promise<Victim[]>;
  getGroups(): Promise<RansomGroup[]>;
  getGroup(slug: string): Promise<RansomGroup | null>;
  getVictimsByGroup(slug: string): Promise<Victim[]>;
  getFilterOptions(): Promise<FilterOptions>;
  /** Victim count per country, for every country present in the data (not just the top N). */
  getCountryCounts(): Promise<CountryCount[]>;
}
