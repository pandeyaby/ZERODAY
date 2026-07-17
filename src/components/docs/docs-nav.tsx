"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAudienceDocs, getReferenceDocs } from "@/lib/docs/content";
import { cn } from "@/lib/cn";

export function DocsNav() {
  const pathname = usePathname();
  const audience = getAudienceDocs();
  const reference = getReferenceDocs();

  const linkClass = (href: string) =>
    cn(
      "block rounded-md px-3 py-2 text-sm transition",
      pathname === href
        ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30"
        : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/[0.03] border border-transparent"
    );

  return (
    <nav className="p-2 space-y-3">
      <div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Start here
        </div>
        <div className="space-y-0.5">
          {audience.map((s) => (
            <Link key={s.slug} href={`/docs/${s.slug}`} className={linkClass(`/docs/${s.slug}`)}>
              {s.title}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Reference
        </div>
        <div className="space-y-0.5">
          {reference.map((s) => (
            <Link key={s.slug} href={`/docs/${s.slug}`} className={linkClass(`/docs/${s.slug}`)}>
              {s.title}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
