import type { DataSource } from "@/lib/types";
import { SeedDataSource } from "@/lib/providers/seedProvider";
import { LiveFeedDataSource } from "@/lib/providers/liveFeedProvider";

// Set RANSOM_DATA_SOURCE=live to pull from the public feed configured via
// RANSOM_FEED_BASE_URL. Defaults to the bundled demo dataset.
export const dataSource: DataSource =
  process.env.RANSOM_DATA_SOURCE === "live"
    ? new LiveFeedDataSource()
    : new SeedDataSource();
