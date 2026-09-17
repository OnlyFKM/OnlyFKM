"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export function Filters({
  groups,
  countries,
  sectors,
}: {
  groups: { slug: string; name: string }[];
  countries: string[];
  sectors: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input
        type="search"
        placeholder="Search victims, groups, sectors…"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => update("q", e.target.value)}
        className="flex-1 min-w-[200px] rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
      />
      <select
        defaultValue={searchParams.get("group") ?? ""}
        onChange={(e) => update("group", e.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
      >
        <option value="">All groups</option>
        {groups.map((g) => (
          <option key={g.slug} value={g.slug}>
            {g.name}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("country") ?? ""}
        onChange={(e) => update("country", e.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
      >
        <option value="">All countries</option>
        {countries.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("sector") ?? ""}
        onChange={(e) => update("sector", e.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
      >
        <option value="">All sectors</option>
        {sectors.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
