import Link from "next/link";
import type { RansomGroup } from "@/lib/types";

export function GroupCard({ group }: { group: RansomGroup }) {
  return (
    <Link
      href={`/groups/${group.slug}`}
      className="block rounded-lg border border-border bg-surface p-4 hover:border-accent/60 transition-colors"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{group.name}</h3>
        <span
          className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
            group.active
              ? "border-accent/40 text-accent"
              : "border-border text-muted"
          }`}
        >
          {group.active ? "Active" : "Inactive"}
        </span>
      </div>
      {group.description && (
        <p className="mt-2 text-sm text-muted line-clamp-2">{group.description}</p>
      )}
      <p className="mt-3 text-xs font-mono text-muted">
        {group.victimCount} listed victim{group.victimCount === 1 ? "" : "s"}
      </p>
    </Link>
  );
}
