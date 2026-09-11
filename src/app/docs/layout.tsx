import Link from "next/link";
import { Shield } from "lucide-react";
import { DocsNav } from "@/components/docs/docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)] bg-[var(--bg-1)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center gap-4">
          <Link href="/docs" className="flex items-center gap-3 min-w-0 group">
            <Shield className="text-[var(--accent)]" size={24} />
            <div>
              <div className="font-display text-lg tracking-[0.18em] text-[var(--accent)] leading-none group-hover:brightness-110">
                ZERODAY
              </div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-1">
                Documentation
              </div>
            </div>
          </Link>
          <div className="flex-1" />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)] border border-[var(--line)] hover:border-[var(--accent)]/50 rounded-md px-3 py-2 transition"
          >
            <Shield size={14} />
            Open Operator
          </Link>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-[1200px] p-4 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        <aside className="panel rounded-lg h-fit md:sticky md:top-[72px] overflow-hidden">
          <div className="panel-header">
            <span className="text-xs font-display tracking-wide uppercase text-[var(--muted)]">
              Contents
            </span>
          </div>
          <DocsNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
