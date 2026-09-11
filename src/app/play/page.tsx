import { OrgUsagePanel } from "@/components/operator/org-usage-panel";
import Link from "next/link";
import { Shield } from "lucide-react";

/**
 * Local-only fixture playground + org usage guide.
 * Start with: npm run play → http://localhost:3333/play
 */
export default function PlayPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)] bg-[var(--bg-1)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <Shield className="text-[var(--accent)]" size={28} />
            <div className="min-w-0">
              <h1 className="font-display text-xl tracking-[0.2em] text-[var(--accent)] leading-none">
                ZERODAY
              </h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mt-1">
                How to use · Fixture playground
              </p>
            </div>
          </Link>
          <div className="flex-1" />
          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
          >
            Operator →
          </Link>
          <div className="flex items-center gap-2">
            <span className="status-dot bg-[var(--accent)]" />
            <span className="text-xs text-[var(--muted)] font-mono">LOCAL</span>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-[1600px] p-4">
        <OrgUsagePanel standalone />
      </main>
    </div>
  );
}
