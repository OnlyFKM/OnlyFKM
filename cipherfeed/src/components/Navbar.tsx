import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-mono font-semibold tracking-tight">
          <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
          Cipherfeed
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted">
          <Link href="/" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <Link href="/victims" className="hover:text-foreground transition-colors">
            Victims
          </Link>
          <Link href="/groups" className="hover:text-foreground transition-colors">
            Groups
          </Link>
        </nav>
      </div>
    </header>
  );
}
