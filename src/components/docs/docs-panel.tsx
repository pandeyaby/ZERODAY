"use client";

import Link from "next/link";
import { getAudienceDocs, getReferenceDocs } from "@/lib/docs/content";
import { BookOpen, Code2, Compass, Layers, Users } from "lucide-react";

const PERSONA_ICON: Record<string, React.ReactNode> = {
  "Non-technical": <Users size={16} />,
  "First-time": <Compass size={16} />,
  Developers: <Code2 size={16} />,
  Architecture: <Layers size={16} />,
};

/** Compact docs index for embedding as a War Room tab. */
export function DocsPanel() {
  const audience = getAudienceDocs();
  const reference = getReferenceDocs();

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="panel rounded-lg overflow-hidden">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[var(--accent)]" />
            <span className="font-display text-sm tracking-wide">Choose your path</span>
          </div>
          <Link
            href="/docs"
            className="text-[10px] uppercase tracking-wider text-[var(--accent)] hover:underline"
          >
            Full docs home →
          </Link>
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-2">
          {audience.map((s) => (
            <Link
              key={s.slug}
              href={`/docs/${s.slug}`}
              className="rounded-md border border-[var(--line)] hover:border-[var(--accent)]/40 px-3 py-3 transition"
            >
              <div className="flex items-center gap-2 text-[var(--accent)] mb-1">
                {PERSONA_ICON[s.persona || ""] || <BookOpen size={16} />}
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  {s.persona}
                </span>
              </div>
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{s.summary}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="panel rounded-lg overflow-hidden">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">Reference</span>
        </div>
        <div className="p-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {reference.map((s) => (
            <Link
              key={s.slug}
              href={`/docs/${s.slug}`}
              className="rounded-md border border-[var(--line)] hover:border-[var(--line-bright)] px-3 py-2 transition"
            >
              <div className="text-xs font-medium truncate">{s.title}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
