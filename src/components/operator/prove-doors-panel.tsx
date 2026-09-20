"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  Check,
  ClipboardCopy,
  Code2,
  DoorClosed,
  DoorOpen,
  ExternalLink,
  Loader2,
  Play,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { useCallback, useState } from "react";

const VERIFY_CMD = "npm run stranger:verify";
const VERIFY_ALIAS = "npm run doors";
/** Prefer --silent so npm’s script banner does not precede the JSON. */
const VERIFY_JSON_CMD = "npm run --silent stranger:verify -- --json";
const API_PATH = "/api/stranger-verify";
const CASSETTE_API_PATH = "/api/cassette-replay";
const CASSETTE_CMD = "npm run cassette:replay";

/** Facts already on docs/gpu-claims.md § Live re-proof (2026-09-19) — invent nothing. */
const DOOR_B_FACTS = [
  "Pod d65ny3xqf7bwza · Secure Cloud · NVIDIA A40",
  "Estimated spend ~$0.034 (under ≤$0.50 ceiling; $0.49/hr at create)",
  "GET /v1/models → 200 · POST /v1/completions → 200",
  "Live locate ranked src/users.js (CWE-89 fixture) · localization-only",
] as const;

const DOC_LINKS = [
  {
    href: "https://github.com/pandeyaby/ZERODAY/blob/main/docs/ci-trust.md",
    label: "docs/ci-trust.md",
    hint: "What the Actions badge proves / does not",
  },
  {
    href: "https://github.com/pandeyaby/ZERODAY/blob/main/docs/stranger-verify.md#machine-readable-json---json",
    label: "docs/stranger-verify.md § --json",
    hint: "Machine-readable Door A card + CI artifact stranger-verify-json",
  },
  {
    href: "https://github.com/pandeyaby/ZERODAY/blob/main/docs/gpu-claims.md#live-re-proof-2026-09-19-pt",
    label: "docs/gpu-claims.md § Live re-proof (2026-09-19)",
    hint: "Dated Door B citation — no GPU spend from this panel",
  },
] as const;

const NON_CLAIMS = [
  "Localization ≠ exploitability · needs_human always",
  "CI badge ≠ vuln proof",
  "No AUROC / File-F1 / org-scale latency SLAs",
  "DIPTYCH grades separately · ZeroDay emits",
  "Probe ≠ measured Secure A40 re-proof · provisioned: false",
] as const;

type ProveDoorsJson = {
  schemaVersion?: string;
  doorA?: unknown;
  doorB?: {
    mode?: string;
    ran?: boolean;
    provisioned?: boolean;
    spendUsd?: number | null;
    probe?: unknown;
  };
  nonClaims?: unknown;
  error?: string;
};

type CassetteReplayJson = {
  schemaVersion?: string;
  ok?: boolean;
  exit?: number;
  mode?: string;
  findingCount?: number;
  rankedFile?: string;
  cweId?: string;
  sarifResultCount?: number;
  recording?: string;
  error?: string;
  code?: string;
};

/**
 * Prove doors — browser surface for stranger Door A (keyless verify) + Door B
 * (citation / optional liveUrl probe) + Keyless K3 cassette:replay.
 * Run calls POST /api/stranger-verify or POST /api/cassette-replay (in-process).
 * No one-click GPU. No invented metrics.
 */
export function ProveDoorsPanel() {
  const [liveUrl, setLiveUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProveDoorsJson | null>(null);
  const [cassetteBusy, setCassetteBusy] = useState(false);
  const [cassetteError, setCassetteError] = useState<string | null>(null);
  const [cassetteResult, setCassetteResult] =
    useState<CassetteReplayJson | null>(null);

  const runVerify = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const trimmed = liveUrl.trim();
      const body = trimmed ? { liveUrl: trimmed } : {};
      const res = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ProveDoorsJson;
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
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
  }, [liveUrl]);

  const runCassetteReplay = useCallback(async () => {
    setCassetteBusy(true);
    setCassetteError(null);
    setCassetteResult(null);
    try {
      const res = await fetch(CASSETTE_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as CassetteReplayJson;
      if (!res.ok) {
        setCassetteError(json.error || `HTTP ${res.status}`);
        setCassetteResult(json.exit != null ? json : null);
      } else {
        setCassetteResult(json);
      }
    } catch (e) {
      setCassetteError((e as Error).message);
      setCassetteResult(null);
    } finally {
      setCassetteBusy(false);
    }
  }, []);

  return (
    <div className="space-y-4 animate-fade-up" data-testid="prove-doors-panel">
      <div className="panel rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge tone="ok">keyless</Badge>
          <Badge tone="muted">no GPU spend</Badge>
          <Badge tone="warn">honest doors</Badge>
        </div>
        <h2 className="font-display text-2xl tracking-wide flex items-center gap-2">
          <DoorOpen size={22} className="text-[var(--accent)]" />
          Prove doors
        </h2>
        <p className="text-sm text-[var(--muted)] mt-2 max-w-3xl">
          Same story as the root README{" "}
          <span className="text-[var(--text)]/80">
            What a stranger can verify today
          </span>
          . Door A runs keyless locally ($0). Door B defaults to a citation; an
          optional operator{" "}
          <code className="text-[var(--accent)]">liveUrl</code> probes{" "}
          <code className="text-[var(--accent)]">GET /v1/models</code> only —
          never provisions pods or invents AUROC / F1 / SLAs.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <article
          className="panel rounded-lg p-4 border border-[var(--line)]"
          data-testid="prove-door-a"
        >
          <div className="flex items-center gap-2 mb-2">
            <DoorOpen size={16} className="text-[var(--accent)]" />
            <h3 className="font-display text-sm tracking-wide text-[var(--accent)]">
              Door A — Keyless
            </h3>
            <Badge tone="ok">runs · $0</Badge>
          </div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Runs{" "}
            <code className="text-[var(--accent)]">npm run trust-loop</code>{" "}
            (fixture SARIF → paired-probe). No GPU, no HF token, no spend. Prints
            PASS + artifact paths under{" "}
            <code className="text-[var(--accent)]">zeroday-reports/trust-loop/</code>
            .
          </p>
          <p className="text-[11px] text-[var(--muted)] mt-2">
            CI job{" "}
            <code className="text-[var(--accent)]">stranger-verify</code> runs
            the same keyless command — badge ≠ vuln proof.
          </p>
        </article>

        <article
          className="panel rounded-lg p-4 border border-[var(--line)]"
          data-testid="prove-door-b"
        >
          <div className="flex items-center gap-2 mb-2">
            <DoorClosed size={16} className="text-[var(--warn)]" />
            <h3 className="font-display text-sm tracking-wide text-[var(--warn)]">
              Door B — Live GPU
            </h3>
            <Badge tone="warn">citation · optional probe</Badge>
          </div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Default is citation only — invent nothing beyond what{" "}
            <code className="text-[var(--accent)]">docs/gpu-claims.md</code>{" "}
            already records. Optional{" "}
            <code className="text-[var(--accent)]">liveUrl</code> validates{" "}
            <em>your</em> endpoint only (
            <code className="text-[var(--accent)]">provisioned: false</code>).
          </p>
          <ul className="mt-3 text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4 font-mono">
            {DOOR_B_FACTS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </article>
      </div>

      <div
        className="panel rounded-lg p-4"
        data-testid="prove-doors-run-card"
      >
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <Play size={14} /> Run prove-doors
          </span>
          <Badge tone="ok">POST {API_PATH}</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Executes Door A in-process via the local Desk API (same JSON as{" "}
          <code className="text-[var(--accent)]">stranger:verify --json</code>
          ). Optional live URL →{" "}
          <code className="text-[var(--accent)]">GET /v1/models</code> only —
          never RunPod create / HF weight pull.
        </p>
        <label className="block text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
          Optional liveUrl (OpenAI-compatible /v1)
        </label>
        <input
          type="url"
          value={liveUrl}
          onChange={(e) => setLiveUrl(e.target.value)}
          placeholder="https://127.0.0.1:8000/v1 (leave empty for citation-only Door B)"
          className={cn(
            "w-full rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
            "px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--muted)]",
            "focus:outline-none focus:border-[var(--accent)]",
          )}
          data-testid="prove-doors-live-url"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            type="button"
            size="md"
            disabled={busy}
            onClick={() => void runVerify()}
            data-testid="prove-doors-run"
            aria-label="Run stranger verify via Desk API"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {busy ? "Running…" : "Run"}
          </Button>
          <span className="text-[11px] text-[var(--muted)]">
            Empty liveUrl → Door B citation · with URL → operator_endpoint probe
          </span>
        </div>
        {error ? (
          <p
            className="mt-3 text-sm text-[var(--danger)]"
            data-testid="prove-doors-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {result ? (
          <div className="mt-3" data-testid="prove-doors-result">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone="ok">
                {String(result.schemaVersion ?? "ok")}
              </Badge>
              {result.doorB?.mode === "operator_endpoint" ? (
                <Badge tone="warn">
                  Door B probe · provisioned:{" "}
                  {String(result.doorB.provisioned ?? false)}
                </Badge>
              ) : (
                <Badge tone="muted">Door B citation</Badge>
              )}
            </div>
            <pre
              className={cn(
                "rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
                "px-3 py-2 text-[11px] font-mono text-[var(--muted)] overflow-x-auto",
                "leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto",
              )}
              data-testid="prove-doors-json-result"
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      <div
        className="panel rounded-lg p-4"
        data-testid="prove-doors-cassette-card"
      >
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <Play size={14} /> Run cassette:replay
          </span>
          <Badge tone="ok">POST {CASSETTE_API_PATH}</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Keyless K3 — offline org cassette replay + pinned assert (same as{" "}
          <code className="text-[var(--accent)]">{CASSETTE_CMD}</code>
          ). Returns mode / findingCount / rankedFile / SARIF count / exit.
          Fail-closed on mismatch. No GPU / RunPod / record.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="md"
            disabled={cassetteBusy || busy}
            onClick={() => void runCassetteReplay()}
            data-testid="prove-doors-cassette-run"
            aria-label="Run cassette replay via Desk API"
          >
            {cassetteBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {cassetteBusy ? "Replaying…" : "Run cassette:replay"}
          </Button>
          <span className="text-[11px] text-[var(--muted)]">
            Default: rules-cwe-89 cassette · findings=1 · src/search.js
          </span>
        </div>
        {cassetteError ? (
          <p
            className="mt-3 text-sm text-[var(--danger)]"
            data-testid="prove-doors-cassette-error"
            role="alert"
          >
            {cassetteError}
          </p>
        ) : null}
        {cassetteResult ? (
          <div className="mt-3" data-testid="prove-doors-cassette-result">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone={cassetteResult.ok === false ? "warn" : "ok"}>
                {String(
                  cassetteResult.schemaVersion ??
                    `exit ${String(cassetteResult.exit ?? "?")}`,
                )}
              </Badge>
              {cassetteResult.mode ? (
                <Badge tone="muted">mode: {cassetteResult.mode}</Badge>
              ) : null}
              {typeof cassetteResult.findingCount === "number" ? (
                <Badge tone="muted">
                  findings: {cassetteResult.findingCount}
                </Badge>
              ) : null}
              {cassetteResult.rankedFile ? (
                <Badge tone="muted">{cassetteResult.rankedFile}</Badge>
              ) : null}
            </div>
            <pre
              className={cn(
                "rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
                "px-3 py-2 text-[11px] font-mono text-[var(--muted)] overflow-x-auto",
                "leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto",
              )}
              data-testid="prove-doors-cassette-json"
            >
              {JSON.stringify(cassetteResult, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="panel rounded-lg p-4">
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <Terminal size={14} /> CLI (secondary)
          </span>
          <Badge tone="muted">copy-paste</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Same command as CI if you prefer the terminal:
        </p>
        <CopyCommand
          command={VERIFY_CMD}
          ariaLabel="Copy stranger:verify command"
          testId="prove-doors-copy"
        />
        <p className="text-[11px] text-[var(--muted)] mt-2">
          Alias:{" "}
          <code className="text-[var(--accent)]">{VERIFY_ALIAS}</code>
          {" · "}
          JSON:{" "}
          <code className="text-[var(--accent)]">{VERIFY_JSON_CMD}</code>
          {" · "}
          live probe:{" "}
          <code className="text-[var(--accent)]">
            npm run stranger:verify -- --live-url http://127.0.0.1:8000/v1
          </code>
        </p>
      </div>

      <div
        className="panel rounded-lg p-4"
        data-testid="prove-doors-json-card"
      >
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <Code2 size={14} /> Expected JSON keys
          </span>
          <Badge tone="muted">zeroday-stranger-verify/v1</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Run returns parseable JSON with{" "}
          <code className="text-[var(--accent)]">schemaVersion</code>,{" "}
          <code className="text-[var(--accent)]">doorA</code>,{" "}
          <code className="text-[var(--accent)]">doorB</code>,{" "}
          <code className="text-[var(--accent)]">nonClaims</code>. CI uploads
          the same shape as artifact{" "}
          <code className="text-[var(--accent)]">stranger-verify-json</code>.
        </p>
        <ul
          className="text-[11px] font-mono space-y-1.5 text-[var(--muted)]"
          data-testid="prove-doors-json-keys"
        >
          <li>
            <code className="text-[var(--accent)]">schemaVersion</code>
            <span> — zeroday-stranger-verify/v1</span>
          </li>
          <li>
            <code className="text-[var(--accent)]">doorA</code>
            <span> — ran: true · status pass · artifact paths</span>
          </li>
          <li>
            <code className="text-[var(--accent)]">doorB.mode</code>
            <span>
              {" "}
              — &quot;citation&quot; or &quot;operator_endpoint&quot; · never
              provisioned: true
            </span>
          </li>
          <li>
            <code className="text-[var(--accent)]">nonClaims</code>
            <span> — honest flags — not AUROC / vuln proof</span>
          </li>
        </ul>
      </div>

      <div className="panel rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
          Docs
        </div>
        <ul className="space-y-2">
          {DOC_LINKS.map((d) => (
            <li
              key={d.href}
              className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3"
            >
              <a
                href={d.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline font-mono"
              >
                {d.label}
                <ExternalLink size={12} className="shrink-0 opacity-70" />
              </a>
              <span className="text-[11px] text-[var(--muted)]">{d.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="panel rounded-lg p-4 flex gap-3 items-start"
        data-testid="prove-doors-non-claims"
      >
        <ShieldAlert
          className="text-[var(--warn)] shrink-0 mt-0.5"
          size={18}
        />
        <div>
          <div className="text-sm font-medium text-[var(--warn)] mb-1">
            Non-claims
          </div>
          <ul className="text-sm text-[var(--muted)] space-y-1 list-disc pl-4">
            {NON_CLAIMS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CopyCommand({
  command,
  ariaLabel,
  testId,
}: {
  command: string;
  ariaLabel: string;
  testId: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-[var(--line)]",
        "bg-[var(--bg-2)] px-3 py-2",
      )}
    >
      <code className="flex-1 min-w-0 font-mono text-sm text-[var(--accent)] break-all">
        {command}
      </code>
      <Button
        size="sm"
        variant="outline"
        type="button"
        className="shrink-0"
        onClick={() => {
          void navigator.clipboard.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
