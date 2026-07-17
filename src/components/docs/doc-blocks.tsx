import { cn } from "@/lib/cn";
import type { DocBlock } from "@/lib/docs/content";

export function DocBlocks({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-[var(--text)]/90">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "p":
            return (
              <p key={i} className="text-[var(--muted)]">
                {b.text}
              </p>
            );
          case "h3":
            return (
              <h3 key={i} className="font-display text-base tracking-wide text-[var(--text)] pt-2">
                {b.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc pl-5 space-y-1.5 text-[var(--muted)]">
                {b.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal pl-5 space-y-1.5 text-[var(--muted)]">
                {b.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre
                key={i}
                className="font-mono text-[11px] overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--bg-0)] p-3 text-[var(--accent)]/90 whitespace-pre"
              >
                {b.text}
              </pre>
            );
          case "callout":
            return (
              <div
                key={i}
                className={cn(
                  "rounded-md border px-3 py-2.5",
                  b.tone === "warn" && "border-[var(--warn)]/40 bg-[var(--warn)]/5",
                  b.tone === "ok" && "border-[var(--accent)]/40 bg-[var(--accent)]/5",
                  b.tone === "info" && "border-[var(--cisco)]/40 bg-[var(--cisco)]/5"
                )}
              >
                <div className="text-[10px] uppercase tracking-wider font-medium mb-1">{b.title}</div>
                <p className="text-[var(--muted)] text-xs">{b.text}</p>
              </div>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-md border border-[var(--line)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-2)] text-[var(--muted)] uppercase tracking-wider">
                    <tr>
                      {b.headers.map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr key={ri} className="border-t border-[var(--line)]">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-[var(--text)]/85 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
