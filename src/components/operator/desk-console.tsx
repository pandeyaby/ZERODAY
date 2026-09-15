"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  Check,
  ClipboardCopy,
  Crosshair,
  FolderOpen,
  FolderTree,
  Loader2,
  Package,
  Play,
  Radio,
  RefreshCw,
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

type DeskPanel = "commands" | "reports";

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
  /* cassette-record */
  fromDir?: string;
  outPath?: string;
  sourceMode?: string;
  redacted?: boolean;
  humanReviewNote?: string;
  cassettePath?: string;
  dir?: string;
};

type ReportListEntry = {
  dir: string;
  name: string;
  mtimeMs: number;
  kind: string;
  mode?: string;
  advisory?: string;
  cweId?: string;
  findingCount?: number;
  hasReportJson: boolean;
  hasCassette: boolean;
  artifactHints: string[];
};

type ReportsList = {
  kind: "reports-list";
  reportsRoot: string;
  entries: ReportListEntry[];
  honesty: string[];
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
  const [panel, setPanel] = useState<DeskPanel>("commands");
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
              . Reports + cassettes are org regression — not discovery.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={panel === "commands" ? "primary" : "outline"}
          onClick={() => setPanel("commands")}
          disabled={busy}
        >
          <Crosshair size={14} />
          Commands
        </Button>
        <Button
          size="sm"
          variant={panel === "reports" ? "primary" : "outline"}
          onClick={() => setPanel("reports")}
          disabled={busy}
          data-testid="reports-panel-tab"
        >
          <FolderOpen size={14} />
          Reports &amp; cassettes
        </Button>
      </div>

      {panel === "commands" && (
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
      )}

      {panel === "reports" && (
        <ReportsPanel
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          setResult={setResult}
          lastLocateDir={
            result?.kind === "locate" && result.outputDir
              ? result.outputDir
              : undefined
          }
        />
      )}

      {error && (
        <div className="panel rounded-lg p-4 border-[var(--danger)]/40 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {result && !error && <DeskResultPanel result={result} />}
    </div>
  );
}

function ReportsPanel({
  busy,
  setBusy,
  setError,
  setResult,
  lastLocateDir,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  setResult: (v: DeskResult | null) => void;
  lastLocateDir?: string;
}) {
  const [list, setList] = useState<ReportsList | null>(null);
  const [selectedDir, setSelectedDir] = useState("");
  const [cassettePath, setCassettePath] = useState("");
  const [cassetteOut, setCassetteOut] = useState("");
  const [replayOut, setReplayOut] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  const refresh = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/reports");
      const json = (await res.json()) as ReportsList & { error?: string };
      if (!res.ok) {
        setError(json.error || "Failed to list reports");
        return;
      }
      setList(json);
      if (!selectedDir && lastLocateDir) {
        setSelectedDir(lastLocateDir);
      } else if (!selectedDir && json.entries?.[0]?.hasReportJson) {
        setSelectedDir(json.entries[0].dir);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingList(false);
    }
  }, [setError, selectedDir, lastLocateDir]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (lastLocateDir) setSelectedDir(lastLocateDir);
  }, [lastLocateDir]);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as DeskResult;
        if (!res.ok) {
          setError(json.error || "Reports action failed");
          setResult(null);
        } else {
          setResult(json);
          if (json.kind === "cassette-record" && json.outPath) {
            setCassettePath(json.outPath);
          }
          if (body.action === "record" || body.action === "replay") {
            void refresh();
          }
        }
      } catch (e) {
        setError((e as Error).message);
        setResult(null);
      } finally {
        setBusy(false);
      }
    },
    [setBusy, setError, setResult, refresh],
  );

  return (
    <div className="panel rounded-lg" data-testid="reports-panel">
      <div className="panel-header">
        <span className="text-sm font-display tracking-wide">
          Reports browser
        </span>
        <Badge tone="muted">org regression · not discovery</Badge>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-[var(--muted)]">
          Browse sandboxed <code className="text-[var(--accent)]">zeroday-reports/</code>,
          preview locate summaries, then record/replay redacted org cassettes.
          Redact is always ON — this UI never offers <code>--no-redact</code>.
        </p>

        <div className="flex flex-wrap gap-2 items-center">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || loadingList}
            onClick={() => void refresh()}
          >
            {loadingList ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Refresh list
          </Button>
          {list?.reportsRoot && (
            <span className="text-[11px] font-mono text-[var(--muted)] truncate">
              {list.reportsRoot}
            </span>
          )}
        </div>

        <div className="border border-[var(--line)] rounded-md max-h-[240px] overflow-auto">
          {list?.entries && list.entries.length > 0 ? (
            <ul className="divide-y divide-[var(--line)] text-xs">
              {list.entries.map((e) => (
                <li key={e.dir}>
                  <button
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 hover:bg-[var(--bg-1)] transition",
                      selectedDir === e.dir && "bg-[var(--accent)]/10",
                    )}
                    onClick={() => setSelectedDir(e.dir)}
                    disabled={busy}
                  >
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-mono text-[var(--fg)]">{e.name}</span>
                      <Badge tone={e.hasReportJson ? "ok" : "muted"}>
                        {e.kind}
                      </Badge>
                      {e.mode && <Badge tone="muted">{e.mode}</Badge>}
                      {e.cweId && (
                        <span className="text-[var(--muted)]">{e.cweId}</span>
                      )}
                      {typeof e.findingCount === "number" && (
                        <span className="text-[var(--muted)]">
                          {e.findingCount} findings
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--muted)] mt-0.5 truncate">
                      {e.dir}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 text-xs text-[var(--muted)]">
              No report dirs yet under zeroday-reports/. Run locate --rules
              first, then refresh.
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block space-y-1 md:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Selected report dir (sandboxed)
            </span>
            <Input
              value={selectedDir}
              onChange={(e) => setSelectedDir(e.target.value)}
              placeholder="zeroday-reports/desk-rules-…"
              disabled={busy}
            />
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Cassette out path (record; optional)
            </span>
            <Input
              value={cassetteOut}
              onChange={(e) => setCassetteOut(e.target.value)}
              placeholder="zeroday-reports/cassettes/org-….cassette.json"
              disabled={busy}
            />
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Cassette path (replay)
            </span>
            <Input
              value={cassettePath}
              onChange={(e) => setCassettePath(e.target.value)}
              placeholder="…/*.cassette.json"
              disabled={busy}
            />
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Replay output dir (optional)
            </span>
            <Input
              value={replayOut}
              onChange={(e) => setReplayOut(e.target.value)}
              placeholder="zeroday-reports/desk-replay-… (default)"
              disabled={busy}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy || !selectedDir.trim()}
            onClick={() =>
              void post({ action: "preview", from: selectedDir.trim() })
            }
          >
            <FolderOpen size={14} />
            Preview summary
          </Button>
          <Button
            size="sm"
            disabled={busy || !selectedDir.trim()}
            onClick={() =>
              void post({
                action: "record",
                from: selectedDir.trim(),
                cassette: cassetteOut.trim() || undefined,
                redact: true,
              })
            }
            data-testid="record-cassette"
          >
            <Radio size={14} />
            Record cassette (redact ON)
          </Button>
          <Button
            size="sm"
            disabled={busy || !cassettePath.trim()}
            onClick={() =>
              void post({
                action: "replay",
                cassette: cassettePath.trim(),
                output: replayOut.trim() || undefined,
              })
            }
            data-testid="replay-cassette"
          >
            <Play size={14} />
            Replay → mode recording
          </Button>
        </div>

        <p className="text-[11px] text-[var(--warn)]">
          Human reviews redaction before commit. ZERODAY never auto-commits or
          uploads cassettes. Preview copies paths only — no arbitrary download
          outside the sandbox.
        </p>

        {list?.honesty && (
          <ul className="text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4">
            {list.honesty.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
      </div>
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
            {result.redacted && <Badge tone="ok">redacted</Badge>}
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
              {result.cassettePath && (
                <CopyRow label="Cassette" value={result.cassettePath} />
              )}
            </>
          )}
          {result.kind === "reports-preview" && (
            <>
              <Meta
                label="Advisory"
                value={`${result.advisory || "—"} → ${result.cweId || "—"}`}
              />
              <Meta label="Findings" value={String(result.findingCount ?? 0)} />
              {result.dir && <CopyRow label="Report dir" value={result.dir} />}
            </>
          )}
          {result.kind === "cassette-record" && (
            <>
              <Meta label="Source mode" value={result.sourceMode || "—"} />
              <Meta label="Findings" value={String(result.findingCount ?? 0)} />
              {result.fromDir && (
                <CopyRow label="From" value={result.fromDir} />
              )}
              {result.outPath && (
                <CopyRow label="Cassette" value={result.outPath} />
              )}
              {result.humanReviewNote && (
                <p className="text-[11px] text-[var(--warn)] border border-[var(--warn)]/30 rounded p-2">
                  {result.humanReviewNote}
                </p>
              )}
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
            <p className="text-xs text-[var(--muted)]">
              {result.kind === "cassette-record"
                ? "Cassette path is in Results — human reviews before commit."
                : "No artifact paths."}
            </p>
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
