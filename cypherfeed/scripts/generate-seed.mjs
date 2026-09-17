// One-off script used to generate the bundled demo dataset in src/data/.
// Run with: node scripts/generate-seed.mjs
// Victim organization names are fictional placeholders; group names refer to
// publicly documented ransomware threat-actor brands used for illustration.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const groups = [
  { slug: "lockbit", name: "LockBit", description: "Ransomware-as-a-service operation known for double-extortion leak sites.", firstSeen: "2019-09-01", active: false },
  { slug: "alphv-blackcat", name: "ALPHV/BlackCat", description: "RaaS group written in Rust, associated with large-scale healthcare and infrastructure incidents.", firstSeen: "2021-11-01", active: false },
  { slug: "clop", name: "Clop", description: "Group known for mass-exploitation of file-transfer vulnerabilities to enable bulk data theft.", firstSeen: "2019-02-01", active: true },
  { slug: "akira", name: "Akira", description: "RaaS operation targeting SMBs and enterprises via VPN and remote-access footholds.", firstSeen: "2023-03-01", active: true },
  { slug: "play", name: "Play", description: "Closed group primarily leveraging exposed remote-access services for initial access.", firstSeen: "2022-06-01", active: true },
  { slug: "blackbasta", name: "Black Basta", description: "RaaS operation active since 2022, frequently linked to social-engineering initial access.", firstSeen: "2022-04-01", active: true },
  { slug: "medusa", name: "Medusa", description: "RaaS group operating a public leak site and multi-extortion tactics.", firstSeen: "2023-01-01", active: true },
  { slug: "rhysida", name: "Rhysida", description: "Group targeting education, healthcare, and government sectors.", firstSeen: "2023-05-01", active: true },
  { slug: "hunters-international", name: "Hunters International", description: "Group believed to have inherited tooling from earlier Hive-linked operations.", firstSeen: "2023-10-01", active: true },
  { slug: "qilin", name: "Qilin", description: "RaaS operation offering affiliates a leak-site and negotiation portal.", firstSeen: "2022-08-01", active: true },
];

const sectors = [
  "Healthcare", "Manufacturing", "Finance", "Retail", "Education",
  "Logistics & Transportation", "Government", "Technology", "Legal Services",
  "Construction", "Energy", "Hospitality",
];

const countries = [
  "United States", "United Kingdom", "Germany", "France", "Canada",
  "Australia", "Brazil", "Spain", "Italy", "Netherlands", "Japan", "Mexico",
];

const orgWords1 = ["Meridian", "Atlas", "Summit", "Northgate", "Cobalt", "Vantage", "Harborview", "Redwood", "Sterling", "Ironbridge", "Bluepeak", "Cascade", "Foundry", "Lumen", "Anchor", "Crestline", "Fieldstone", "Riverside", "Wavefront", "Thornbury"];
const orgWords2 = ["Health Group", "Logistics", "Manufacturing Co.", "Financial Partners", "University", "Retail Holdings", "Energy Corp.", "Legal Group", "Technologies", "Construction Ltd.", "Hospitality Group", "Systems Inc.", "Industries", "Medical Center", "Credit Union", "Freight Services"];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seededRandom(42);
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function randomDateWithinDays(days) {
  const now = new Date("2026-09-17T00:00:00Z");
  const past = new Date(now.getTime() - rand() * days * 24 * 60 * 60 * 1000);
  return past.toISOString().slice(0, 10);
}

const victims = [];
const victimCountByGroup = Object.fromEntries(groups.map((g) => [g.slug, 0]));

for (let i = 0; i < 180; i++) {
  const group = pick(groups);
  const name = `${pick(orgWords1)} ${pick(orgWords2)}`;
  const sector = pick(sectors);
  const country = pick(countries);
  const discoveredAt = randomDateWithinDays(220);
  victimCountByGroup[group.slug] += 1;
  victims.push({
    id: `v-${i + 1}`,
    name,
    group: group.name,
    groupSlug: group.slug,
    country,
    sector,
    discoveredAt,
    description: `Listed on the ${group.name} leak site. Entry is for demonstration purposes only and does not reference a real organization.`,
  });
}

victims.sort((a, b) => (a.discoveredAt < b.discoveredAt ? 1 : -1));

const groupsWithCounts = groups.map((g) => ({
  ...g,
  victimCount: victimCountByGroup[g.slug] ?? 0,
}));

writeFileSync(
  path.join(__dirname, "../src/data/seed-groups.json"),
  JSON.stringify(groupsWithCounts, null, 2) + "\n"
);
writeFileSync(
  path.join(__dirname, "../src/data/seed-victims.json"),
  JSON.stringify(victims, null, 2) + "\n"
);

console.log(`Generated ${groupsWithCounts.length} groups and ${victims.length} victims.`);
