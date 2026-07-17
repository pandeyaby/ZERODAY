import Link from "next/link";
import { notFound } from "next/navigation";
import { DocBlocks } from "@/components/docs/doc-blocks";
import { DOC_SECTIONS, getDoc } from "@/lib/docs/content";

export function generateStaticParams() {
  return DOC_SECTIONS.map((s) => ({ slug: s.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const doc = getDoc(slug);
    return {
      title: doc ? `${doc.title} · ZERODAY Docs` : "ZERODAY Docs",
      description: doc?.summary,
    };
  });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const idx = DOC_SECTIONS.findIndex((s) => s.slug === slug);
  const prev = idx > 0 ? DOC_SECTIONS[idx - 1] : null;
  const next = idx >= 0 && idx < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[idx + 1] : null;

  return (
    <article className="panel rounded-lg animate-fade-up overflow-hidden">
      <div className="panel-header">
        <div>
          <h1 className="font-display text-xl tracking-wide">{doc.title}</h1>
          <p className="text-xs text-[var(--muted)] mt-1">{doc.summary}</p>
        </div>
        <span className="font-mono text-[10px] text-[var(--muted)]">
          {idx + 1}/{DOC_SECTIONS.length}
        </span>
      </div>
      <div className="p-5 md:p-6">
        <DocBlocks blocks={doc.body} />
      </div>
      <div className="border-t border-[var(--line)] p-4 flex flex-col sm:flex-row gap-3 justify-between">
        {prev ? (
          <Link
            href={`/docs/${prev.slug}`}
            className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition"
          >
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/docs/${next.slug}`}
            className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition sm:text-right"
          >
            {next.title} →
          </Link>
        ) : (
          <Link href="/" className="text-xs text-[var(--accent)] hover:brightness-110 transition sm:text-right">
            Open War Room →
          </Link>
        )}
      </div>
    </article>
  );
}
