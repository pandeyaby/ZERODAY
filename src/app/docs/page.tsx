import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Code2, Compass, Layers, Users } from "lucide-react";
import { getAudienceDocs, getReferenceDocs } from "@/lib/docs/content";

const PERSONA_ICON: Record<string, ReactNode> = {
  "Non-technical": <Users size={20} />,
  "First-time": <Compass size={20} />,
  Developers: <Code2 size={20} />,
  Architecture: <Layers size={20} />,
};

export default function DocsIndexPage() {
  const audience = getAudienceDocs();
  const reference = getReferenceDocs();

  return (
    <div className="space-y-4 animate-fade-up">
      <section className="panel rounded-lg overflow-hidden">
        <div className="panel-header">
          <div>
            <h1 className="font-display text-xl tracking-wide">ZERODAY Docs</h1>
            <p className="text-xs text-[var(--muted)] mt-1">
              Pick a path that matches how you work — then dive into reference guides.
            </p>
          </div>
          <BookOpen size={18} className="text-[var(--accent)]" />
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          {audience.map((s) => (
            <Link
              key={s.slug}
              href={`/docs/${s.slug}`}
              className="rounded-md border border-[var(--line)] hover:border-[var(--accent)]/50 bg-[var(--bg-0)]/40 px-4 py-4 transition group"
            >
              <div className="flex items-start gap-3">
                <div className="text-[var(--accent)] mt-0.5">
                  {PERSONA_ICON[s.persona || ""] || <BookOpen size={20} />}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    {s.persona}
                  </div>
                  <div className="text-sm font-medium group-hover:text-[var(--accent)] transition">
                    {s.title}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">{s.summary}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel rounded-lg overflow-hidden">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">Reference guides</span>
        </div>
        <div className="p-3 grid sm:grid-cols-2 gap-2">
          {reference.map((s) => (
            <Link
              key={s.slug}
              href={`/docs/${s.slug}`}
              className="rounded-md border border-[var(--line)] hover:border-[var(--line-bright)] px-3 py-2.5 transition"
            >
              <div className="text-sm">{s.title}</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-2">{s.summary}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
