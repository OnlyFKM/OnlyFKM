"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Periodically re-runs the current route's server rendering (without a full
 * page reload) so an open tab picks up new data on its own. Actual data
 * freshness is still bounded by the data source's own cache window (e.g. the
 * live feed provider's 15-minute revalidate).
 */
export function AutoRefresh({ intervalMs = 5 * 60 * 1000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
