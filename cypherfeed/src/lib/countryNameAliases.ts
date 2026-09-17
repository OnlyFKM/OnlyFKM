// The world-atlas topojson (Natural Earth data) spells some country names
// differently from the common English names our data sources use. This maps
// our names to the map's names; extend it if a new country doesn't shade in.
const ALIASES: Record<string, string> = {
  "United States": "United States of America",
  "USA": "United States of America",
  "UK": "United Kingdom",
  "Czech Republic": "Czechia",
  "Democratic Republic of the Congo": "Dem. Rep. Congo",
  "Republic of the Congo": "Congo",
  "Central African Republic": "Central African Rep.",
  "Dominican Republic": "Dominican Rep.",
  "Bosnia and Herzegovina": "Bosnia and Herz.",
  "Equatorial Guinea": "Eq. Guinea",
  "Ivory Coast": "Côte d'Ivoire",
  "North Macedonia": "Macedonia",
  "Eswatini": "eSwatini",
  "Swaziland": "eSwatini",
};

export function toMapCountryName(name: string): string {
  return ALIASES[name] ?? name;
}
