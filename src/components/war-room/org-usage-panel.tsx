"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  Building2,
  Crosshair,
  FlaskConical,
  GitBranch,
  ShieldAlert,
  User,
  Loader2,
  Terminal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type View = "person" | "org" | "playground";

type Catalog = {
  classifyScenarios: string[];
  honesty: string[];
};

type PlayResult = {
  kind: string;
  mode: string;
  honesty?: string;
  advisory?: string;
  cweId?: string;
  findingCount?: number;
  rankedFiles?: Array<{
    rank: number;
    filePath: string;
    title: string;
    cweIds: string[];
  }>;
  scenario?: string;
  classification?: string;
  confidence?: number;
  needs_human?: boolean;
  east_west_suspected?: boolean;
  cases?: Array<{
    scenario: string;
    classification: string;
    east_west_suspected: boolean;
  }>;
  outputDir?: string;
  paths?: Record<string, string>;
  sarifSummary?: {
    version: string;
    toolName: string;
    resultCount: number;
    ruleCount: number;
    level: string;
    topResults: Array<{
      ruleId: string;
      level: string;
      message: string;
      uri?: string;
    }>;
    posture: string;
  } | null;
  splunkSnippet?: unknown[];
  cisoMarkdown?: string;
  ciso?: unknown;
  error?: string;
};

const PERSON_SECTIONS = [
  {
    title: "Morning / PR",
    body: "Leave the GitHub Action on forever. It runs fixture locate → SARIF upload → reviewable PR comment → soft-fail. No GPU in CI. Findings do not fail the job by default (localization ≠ exploitability).",
  },
  {
    title: "Known CWE / CVE / GHSA",
    body: "Run `zeroday locate` locally. Live mode needs vLLM + HF-gated Antares-1B on the operator GPU. Source never leaves the machine. Fixture mode works without weights.",
  },
  {
    title: "CISO skim",
    body: "Use `zeroday demo` or `zeroday classify` → `ciso.md` / `ciso.json`. Localization is not exploitability. Human review is required on every CISO object (`needs_human: true`).",
  },
  {
    title: "Never auto-merge",
    body: "Draft-fix only with `--i-asked-for-a-fix`. No PoCs. If anyone asks for an exploit, ZERODAY refuses in one sentence and still only emits a patch draft when gated.",
  },
] as const;

const ORG_SECTIONS = [
  {
    role: "Platform eng",
    body: "Wire the Action on every repo. Fixture-only on ubuntu-latest — no GPU, no weight download, no Docker-in-Docker for locate.",
  },
  {
    role: "Security analyst",
    body: "Run `locate` on a workstation (fixture or live). Ingest SARIF into GitHub Code Scanning. Triage ranked files as detector-lane candidates.",
  },
  {
    role: "SOC / Splunk / Cisco Security Cloud buyer",
    body: "Take Splunk CIM JSON, ASFF, and the CISO object as FILES. Your team ingests them with your credentials. ZERODAY does not push to your clouds.",
  },
  {
    role: "Classifier honesty",
    body: "Four-class classifier is fixture-driven: possible_breach | infra_failure | software_defect | agent_misfire | needs_human. Ambiguous → needs_human. Do not claim live agent-misfire SOC.",
  },
] as const;

export function OrgUsagePanel({
  standalone = false,
}: {
  standalone?: boolean;
}) {
  const [view, setView] = useState<View>("person");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [scenario, setScenario] = useState("software_defect");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/playground")
      .then((r) => r.json())
      .then((j: Catalog & { classifyScenarios?: string[] }) => {
        setCatalog(j);
        if (j.classifyScenarios?.[0]) setScenario(j.classifyScenarios[0]);
      })
      .catch(() => {
        /* War Room may be offline in unit contexts */
      });
  }, []);

  const run = useCallback(
    async (action: "locate" | "classify" | "demo") => {
      setBusy(true);
      setError(null);
      setView("playground");
      try {
        const res = await fetch("/api/playground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            scenario: action === "classify" ? scenario : undefined,
          }),
        });
        const json = (await res.json()) as PlayResult;
        if (!res.ok) {
          setError(json.error || "Playground run failed");
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
    },
    [scenario],
  );

  return (
    <div className={cn("space-y-4", standalone && "animate-fade-up")}>
      <div className="panel rounded-lg p-4 scanline-overlay relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge tone="ok">local only</Badge>
              <Badge tone="muted">fixtures</Badge>
              <Badge tone="warn">human in the loop</Badge>
            </div>
            <h2 className="font-display text-2xl tracking-wide">
              How to use ZERODAY
            </h2>
            <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
              Honest guidance for people and orgs — what the code actually does.
              Playground below runs the same fixture paths as the CLI (no live
              network, no gated weights).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["person", "Best for a person", <User size={14} key="u" />],
                ["org", "How orgs use it", <Building2 size={14} key="b" />],
                [
                  "playground",
                  "Fixture playground",
                  <FlaskConical size={14} key="f" />,
                ],
              ] as const
            ).map(([id, label, icon]) => (
              <Button
                key={id}
                size="sm"
                variant={view === id ? "primary" : "outline"}
                onClick={() => setView(id)}
              >
                {icon}
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {view === "person" && (
        <div className="grid md:grid-cols-2 gap-3 animate-fade-up">
          {PERSON_SECTIONS.map((s) => (
            <article
              key={s.title}
              className="panel rounded-lg p-4 border border-[var(--line)]"
            >
              <h3 className="font-display text-sm tracking-wide text-[var(--accent)]">
                {s.title}
              </h3>
              <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
                {s.body}
              </p>
            </article>
          ))}
          <div className="md:col-span-2 panel rounded-lg p-4">
            <div className="panel-header !px-0 !pt-0 !border-0">
              <span className="text-sm font-display tracking-wide flex items-center gap-2">
                <Terminal size={14} /> CLI anchors
              </span>
            </div>
            <pre className="mt-2 font-mono text-[11px] text-[var(--muted)] overflow-x-auto whitespace-pre-wrap">
{`npm run zeroday -- locate --cwe CWE-89 --fixture
npm run zeroday -- classify --scenario possible_breach
npm run zeroday -- demo --output zeroday-reports/mixed-pack
npm run zeroday -- draft-fix --i-asked-for-a-fix --from …/report.json`}
            </pre>
          </div>
        </div>
      )}

      {view === "org" && (
        <div className="space-y-3 animate-fade-up">
          {ORG_SECTIONS.map((s) => (
            <article
              key={s.role}
              className="panel rounded-lg px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-start"
            >
              <div className="sm:w-48 shrink-0">
                <Badge tone="cisco">{s.role}</Badge>
              </div>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                {s.body}
              </p>
            </article>
          ))}
          <div className="panel rounded-lg p-4 flex gap-3 items-start">
            <ShieldAlert
              className="text-[var(--warn)] shrink-0 mt-0.5"
              size={18}
            />
            <div className="text-sm text-[var(--muted)]">
              <span className="text-[var(--warn)] font-medium">
                Buyer ingest posture:{" "}
              </span>
              Splunk CIM JSON, ASFF, and CISO objects are local files your SOC
              owns. We write them; you ingest them. No BatchImportFindings, no
              Splunk push, no live Cisco Security Cloud API from this repo.
            </div>
          </div>
        </div>
      )}

      {(view === "playground" || result || busy) && (
        <div
          className={cn(
            "space-y-4",
            view === "playground" && "animate-fade-up",
          )}
        >
          <div className="panel rounded-lg">
            <div className="panel-header">
              <span className="text-sm font-display tracking-wide flex items-center gap-2">
                <FlaskConical size={14} /> Fixture playground
              </span>
              <Badge tone="ok">no weights</Badge>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-[var(--muted)]">
                Buttons call existing fixture paths via{" "}
                <code className="text-[var(--accent)]">/api/playground</code>.
                Same engines as{" "}
                <code className="text-[var(--accent)]">zeroday locate</code>,{" "}
                <code className="text-[var(--accent)]">classify</code>, and{" "}
                <code className="text-[var(--accent)]">demo</code>.
              </p>

              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  disabled={busy}
                  onClick={() => void run("locate")}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
                  Locate CWE-89
                </Button>

                <select
                  className="rounded-md border border-[var(--line)] bg-[var(--bg-1)] px-2 py-2 text-xs"
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  disabled={busy}
                >
                  {(catalog?.classifyScenarios || [
                    "software_defect",
                    "possible_breach",
                    "infra_failure",
                    "agent_misfire",
                    "needs_human",
                  ]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("classify")}
                >
                  Classify scenario
                </Button>

                <Button
                  variant="warn"
                  disabled={busy}
                  onClick={() => void run("demo")}
                >
                  <GitBranch size={14} />
                  Mixed demo
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

          {result && !error && <PlayResultView result={result} />}
        </div>
      )}
    </div>
  );
}

function PlayResultView({ result }: { result: PlayResult }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 animate-fade-up">
      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">
            Run summary
          </span>
          <Badge tone="ok">{result.kind}</Badge>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {result.kind === "locate" && (
            <>
              <Meta
                label="Advisory"
                value={`${result.advisory} → ${result.cweId}`}
              />
              <Meta label="Findings" value={String(result.findingCount ?? 0)} />
              {result.rankedFiles?.length ? (
                <ul className="text-xs space-y-1 font-mono text-[var(--muted)]">
                  {result.rankedFiles.map((f) => (
                    <li key={f.filePath}>
                      {f.rank}. {f.filePath} — {f.title}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          {result.kind === "classify" && (
            <>
              <Meta label="Scenario" value={result.scenario || "—"} />
              <Meta
                label="Classification"
                value={result.classification || "—"}
              />
              <Meta
                label="Needs human"
                value={result.needs_human ? "yes (always)" : "—"}
              />
              <Meta
                label="East-west suspected"
                value={result.east_west_suspected ? "yes (from INPUT)" : "no"}
              />
            </>
          )}
          {result.kind === "demo" && result.cases && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--muted)] text-left">
                    <th className="py-1 pr-2">Scenario</th>
                    <th className="py-1 pr-2">Class</th>
                    <th className="py-1">E-W</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cases.map((c) => (
                    <tr key={c.scenario} className="border-t border-[var(--line)]">
                      <td className="py-1.5 pr-2 font-mono">{c.scenario}</td>
                      <td className="py-1.5 pr-2">{c.classification}</td>
                      <td className="py-1.5">
                        {c.east_west_suspected ? "yes" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.outputDir && (
            <Meta label="Output" value={result.outputDir} mono />
          )}
          <p className="text-[11px] text-[var(--warn)] border-t border-[var(--line)] pt-3">
            {result.honesty}
          </p>
        </div>
      </div>

      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">
            SARIF summary
          </span>
          {result.sarifSummary && (
            <Badge tone="muted">
              {result.sarifSummary.resultCount} results ·{" "}
              {result.sarifSummary.level}
            </Badge>
          )}
        </div>
        <div className="p-4">
          {result.sarifSummary ? (
            <div className="space-y-2 text-xs">
              <Meta
                label="Tool"
                value={`${result.sarifSummary.toolName} (SARIF ${result.sarifSummary.version})`}
              />
              <Meta label="Posture" value={result.sarifSummary.posture} />
              <ul className="font-mono text-[var(--muted)] space-y-1 mt-2">
                {result.sarifSummary.topResults.map((r, i) => (
                  <li key={`${r.ruleId}-${i}`}>
                    [{r.level}] {r.ruleId}
                    {r.uri ? ` · ${r.uri}` : ""} — {r.message}
                  </li>
                ))}
                {!result.sarifSummary.topResults.length && (
                  <li>No SARIF results in this run.</li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              No locate SARIF for this classify-only scenario.
            </p>
          )}
        </div>
      </div>

      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">
            Splunk-shaped JSON
          </span>
          <Badge tone="splunk">CIM snippet</Badge>
        </div>
        <pre className="p-4 font-mono text-[10px] overflow-auto max-h-[280px] scrollbar-thin text-[var(--muted)]">
          {result.splunkSnippet?.length
            ? JSON.stringify(result.splunkSnippet, null, 2)
            : "// No Splunk events for this run"}
        </pre>
      </div>

      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">
            CISO markdown
          </span>
          <Badge tone="cisco">on screen</Badge>
        </div>
        <pre className="p-4 font-mono text-[10px] overflow-auto max-h-[280px] scrollbar-thin text-[var(--muted)] whitespace-pre-wrap">
          {result.cisoMarkdown || "// No CISO markdown"}
        </pre>
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
