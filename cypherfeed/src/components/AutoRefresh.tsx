"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FEED_REVALIDATE_SECONDS } from "@/lib/config";

/**
 * Periodically re-runs the current route's server rendering (without a full
 * page reload) so an open tab picks up new data on its own. Matches the live
 * feed provider's cache window so it never polls faster than new data can
 * actually appear.
 */
export function AutoRefresh({
  intervalMs = FEED_REVALIDATE_SECONDS * 1000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
