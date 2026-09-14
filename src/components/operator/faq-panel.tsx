"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { FAQ_INTRO, FAQ_ITEMS, type FaqBlock } from "@/faq/content";
import { CircleHelp, ChevronDown } from "lucide-react";
import { useState } from "react";

function FaqAnswer({ blocks }: { blocks: FaqBlock[] }) {
  return (
    <div className="space-y-3 text-sm text-[var(--muted)] leading-relaxed">
      {blocks.map((block, i) => {
        if (block.type === "p") {
          return (
            <p key={i} className="text-[var(--muted)]">
              {block.text}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <div
            key={i}
            className="overflow-x-auto rounded-md border border-[var(--line)]"
          >
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-2)] text-[var(--muted)] uppercase tracking-wider">
                <tr>
                  {block.headers.map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-[var(--line)]">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-2 text-[var(--text)]/85 align-top"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Accordion FAQ for play / operator — same Q&As as docs/faq.md.
 */
export function FaqPanel() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  return (
    <div className="space-y-4 animate-fade-up" data-testid="faq-panel">
      <div className="panel rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge tone="warn">honesty</Badge>
          <Badge tone="muted">keyless strength</Badge>
          <Badge tone="ok">localization ≠ exploitability</Badge>
        </div>
        <h2 className="font-display text-2xl tracking-wide flex items-center gap-2">
          <CircleHelp size={22} className="text-[var(--accent)]" />
          FAQ
        </h2>
        <p className="text-sm text-[var(--muted)] mt-2 max-w-3xl">{FAQ_INTRO}</p>
        <p className="text-[11px] text-[var(--muted)] mt-2">
          Same answers as{" "}
          <code className="text-[var(--accent)]">docs/faq.md</code> — one
          structured source under{" "}
          <code className="text-[var(--accent)]">src/faq/content.ts</code>.
        </p>
      </div>

      <div className="space-y-2">
        {FAQ_ITEMS.map((item) => {
          const open = openId === item.id;
          return (
            <article
              key={item.id}
              className="panel rounded-lg overflow-hidden border border-[var(--line)]"
            >
              <button
                type="button"
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--bg-2)]/50 transition"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <span className="min-w-0 flex-1 font-display text-sm tracking-wide text-[var(--accent)]">
                  {item.question}
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "shrink-0 mt-0.5 text-[var(--muted)] transition-transform",
                    open && "rotate-180 text-[var(--accent)]",
                  )}
                />
              </button>
              {open && (
                <div className="px-4 pb-4 border-t border-[var(--line)] pt-3">
                  <FaqAnswer blocks={item.answer} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
