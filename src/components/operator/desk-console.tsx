"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  Check,
  ClipboardCopy,
  Crosshair,
  FolderTree,
  Loader2,
  Package,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type DeskAction =
  | "rules"
  | "from-sarif"
  | "inventory"
  | "packet"
  | "harden"
  | "classify"
  | "craft";

type DeskCatalog = {
  kind: "catalog";
  allowedRoots: string[];
  defaults: {
    cwe: string;
    rulesRepo: string;
    sarifPath: string;
    inventoryRepo: string;
  };
  honesty: string[];
};

type DeskResult = {
  kind: string;
  mode: string;
  action?: string;
  advisory?: string;
  cweId?: string;
  findingCount?: number;
  recommendationCount?: number;
  fileCount?: number;
  languages?: string[];
  classification?: string;
  confidence?: number;
  scaffoldKind?: string;
  source?: string;
  repoRoot?: string;
  rankedFiles?: Array<{
    rank: number;
    filePath: string;
    title: string;
    cweIds: string[];
  }>;
  outputDir?: string;
  paths?: Record<string, string>;
  warnings?: string[];
  needs_human?: boolean;
  honesty?: string;
  error?: string;
  code?: string;
};

const COMMANDS: Array<{
  id: DeskAction;
  label: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  {
    id: "rules",
    label: "locate --rules",
    hint: "Keyless heuristics on a sandboxed repo",
    icon: <Crosshair size={14} />,
  },
  {
    id: "from-sarif",
    label: "locate --from-sarif",
    hint: "Ingest a local SARIF file",
    icon: <Package size={14} />,
  },
  {
    id: "inventory",
    label: "inventory",
    hint: "Desk B config / multi-repo inventory",
    icon: <FolderTree size={14} />,
  },
  {
    id: "packet",
    label: "packet",
    hint: "Desk A offline security packet",
    icon: <Package size={14} />,
  },
  {
    id: "harden",
    label: "harden",
    hint: "Desk C recommend-only harden",
    icon: <Wrench size={14} />,
  },
  {
    id: "classify",
    label: "classify",
    hint: "Desk E classify (≠ exploitability)",
    icon: <ShieldCheck size={14} />,
  },
  {
    id: "craft",
    label: "craft",
    hint: "Desk D defensive scaffolds",
    icon: <Wrench size={14} />,
  },
];

export function DeskConsole() {
  const [catalog, setCatalog] = useState<DeskCatalog | null>(null);
  const [action, setAction] = useState<DeskAction>("rules");
  const [cwe, setCwe] = useState("CWE-89");
  const [repo, setRepo] = useState("");
  const [sarif, setSarif] = useState("");
  const [from, setFrom] = useState("docs/reports");
  const [output, setOutput] = useState("");
  const [fixture, setFixture] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DeskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/desk")
      .then((r) => r.json())
      .then((j: DeskCatalog) => {
        setCatalog(j);
        setCwe(j.defaults?.cwe || "CWE-89");
        setRepo(j.defaults?.rulesRepo || "");
        setSarif(j.defaults?.sarifPath || "");
      })
      .catch(() => {
        /* offline unit contexts */
      });
  }, []);

  useEffect(() => {
    if (!catalog) return;
    if (action === "rules") {
      setRepo(catalog.defaults.rulesRepo);
      setFixture(false);
    } else if (action === "from-sarif") {
      setSarif(catalog.defaults.sarifPath);
      setFixture(false);
    } else if (action === "inventory") {
      setRepo(catalog.defaults.inventoryRepo);
    }
  }, [action, catalog]);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        action,
        output: output.trim() || undefined,
      };
      if (action === "rules") {
        body.cwe = cwe;
        body.repo = repo;
      } else if (action === "from-sarif") {
        body.sarif = sarif;
        body.repo = repo || undefined;
        body.cwe = cwe || undefined;
      } else if (action === "inventory") {
        body.repo = fixture ? undefined : repo;
        body.fixture = fixture;
      } else {
        body.from = fixture ? undefined : from;
        body.fixture = fixture || !from.trim();
      }

      const res = await fetch("/api/desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as DeskResult;
      if (!res.ok) {
        setError(json.error || "Desk run failed");
        setResult(null);
      } else {
        setResult(json);
      }
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, [action, cwe, repo, sarif, from, output, fixture]);

  const needsRepo = action === "rules" || action === "inventory";
  const needsSarif = action === "from-sarif";
  const needsFrom =
    action === "packet" ||
    action === "harden" ||
    action === "classify" ||
    action === "craft";

  return (
    <div className="space-y-4 animate-fade-up" data-testid="desk-console">
      <div className="panel rounded-lg p-4 border border-[var(--warn)]/30 bg-[var(--warn)]/5">
        <div className="flex gap-3 items-start">
          <ShieldAlert
            className="text-[var(--warn)] shrink-0 mt-0.5"
            size={18}
          />
          <div className="text-sm text-[var(--muted)] space-y-1">
            <p>
              <span className="text-[var(--warn)] font-medium">
                Hard limits:{" "}
              </span>
              <code className="text-[var(--accent)]">needs_human</code> always ·
              no PoC · localization ≠ exploitability · no auto-merge · no live
              Antares spend UI
            </p>
            <p className="text-xs">
              Desk Console imports locate / desk libs in-process. Paths must stay
              under workspace roots
              {catalog?.allowedRoots?.[0]
                ? ` (default: ${catalog.allowedRoots[0]})`
                : " (cwd + ZERODAY_UI_ROOTS)"}
              .
            </p>
          </div>
        </div>
      </div>

      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">
            Desk Console
          </span>
          <Badge tone="ok">local · in-process</Badge>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {COMMANDS.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={action === c.id ? "primary" : "outline"}
                onClick={() => setAction(c.id)}
                disabled={busy}
              >
                {c.icon}
                {c.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)]">
            {COMMANDS.find((c) => c.id === action)?.hint}
          </p>

          <div className="grid md:grid-cols-2 gap-3">
            {(action === "rules" || needsSarif) && (
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  CWE / advisory
                </span>
                <Input
                  value={cwe}
                  onChange={(e) => setCwe(e.target.value)}
                  placeholder="CWE-89"
                  disabled={busy}
                />
              </label>
            )}
            {needsRepo && (
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  Repo path (sandboxed)
                </span>
                <Input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="fixtures/locate/rules-sample"
                  disabled={busy || (action === "inventory" && fixture)}
                />
              </label>
            )}
            {needsSarif && (
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  SARIF file path (sandboxed)
                </span>
                <Input
                  value={sarif}
                  onChange={(e) => setSarif(e.target.value)}
                  placeholder="fixtures/locate/ingest-sample/sample.sarif"
                  disabled={busy}
                />
              </label>
            )}
            {needsFrom && (
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  From reports dir (sandboxed)
                </span>
                <Input
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="docs/reports"
                  disabled={busy || fixture}
                />
              </label>
            )}
            <label className="block space-y-1 md:col-span-2">
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                Output dir (optional, sandboxed)
              </span>
              <Input
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                placeholder="zeroday-reports/desk-console (default)"
                disabled={busy}
              />
            </label>
          </div>

          {(action === "inventory" || needsFrom) && (
            <label className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={fixture}
                onChange={(e) => setFixture(e.target.checked)}
                disabled={busy}
              />
              Use checked-in fixture / docs reports (--fixture)
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void run()}>
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Crosshair size={14} />
              )}
              Run {COMMANDS.find((c) => c.id === action)?.label}
            </Button>
          </div>

          {catalog?.honesty && (
            <ul className="text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4">
              {catalog.honesty.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div className="panel rounded-lg p-4 border-[var(--danger)]/40 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {result && !error && <DeskResultPanel result={result} />}
    </div>
  );
}

function DeskResultPanel({ result }: { result: DeskResult }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 animate-fade-up">
      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">Results</span>
          <div className="flex gap-1.5">
            <Badge tone="ok">{result.mode}</Badge>
            {result.needs_human && <Badge tone="warn">needs_human</Badge>}
          </div>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {result.kind === "locate" && (
            <>
              <Meta
                label="Advisory"
                value={`${result.advisory} → ${result.cweId}`}
              />
              <Meta label="Findings" value={String(result.findingCount ?? 0)} />
            </>
          )}
          {result.kind === "inventory" && (
            <>
              <Meta label="Source" value={result.source || "—"} />
              <Meta label="Repo" value={result.repoRoot || "—"} mono />
              <Meta label="Files" value={String(result.fileCount ?? 0)} />
              <Meta label="Findings" value={String(result.findingCount ?? 0)} />
              <Meta
                label="Languages"
                value={result.languages?.join(", ") || "—"}
              />
            </>
          )}
          {result.kind === "packet" && (
            <Meta label="Findings" value={String(result.findingCount ?? 0)} />
          )}
          {result.kind === "harden" && (
            <Meta
              label="Recommendations"
              value={String(result.recommendationCount ?? 0)}
            />
          )}
          {result.kind === "classify" && (
            <>
              <Meta
                label="Classification"
                value={result.classification || "—"}
              />
              <Meta
                label="Confidence"
                value={String(result.confidence ?? "—")}
              />
            </>
          )}
          {result.kind === "craft" && (
            <Meta label="Scaffold" value={result.scaffoldKind || "—"} />
          )}
          {result.outputDir && (
            <CopyRow label="Output" value={result.outputDir} />
          )}
          {result.rankedFiles && result.rankedFiles.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                Ranked files
              </div>
              <ul className="text-xs space-y-1 font-mono text-[var(--muted)] max-h-[220px] overflow-auto">
                {result.rankedFiles.map((f) => (
                  <li key={`${f.rank}-${f.filePath}`}>
                    {f.rank}. {f.filePath}
                    {f.title ? ` — ${f.title}` : ""}
                    {f.cweIds?.length ? ` (${f.cweIds.join(", ")})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-[var(--warn)] border-t border-[var(--line)] pt-3">
            {result.honesty}
          </p>
        </div>
      </div>

      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">
            Artifact paths
          </span>
          <Badge tone="muted">copy</Badge>
        </div>
        <div className="p-4 space-y-2">
          {result.paths &&
            Object.entries(result.paths).map(([k, v]) => (
              <CopyRow key={k} label={k} value={v} />
            ))}
          {(!result.paths || Object.keys(result.paths).length === 0) && (
            <p className="text-xs text-[var(--muted)]">No artifact paths.</p>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <div className="pt-2 border-t border-[var(--line)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                Warnings
              </div>
              <ul className="text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className={cn("mt-0.5", mono && "font-mono text-xs break-all")}>
        {value}
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          {label}
        </div>
        <div className="font-mono text-[var(--muted)] break-all">{value}</div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0"
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
      </Button>
    </div>
  );
}
