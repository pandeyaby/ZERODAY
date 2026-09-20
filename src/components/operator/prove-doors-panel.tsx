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
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { useState } from "react";

const VERIFY_CMD = "npm run stranger:verify";
const VERIFY_ALIAS = "npm run doors";
/** Prefer --silent so npm’s script banner does not precede the JSON. */
const VERIFY_JSON_CMD = "npm run --silent stranger:verify -- --json";

/** Static shape only — not live output. Desk does not shell out / invent metrics. */
const JSON_EXAMPLE = `{
  "schemaVersion": "zeroday-stranger-verify/v1",
  "doorA": { "status": "pass", "ran": true, "command": "…", "artifacts": { "…": "…" } },
  "doorB": { "mode": "citation", "ran": false, "citation": { "…": "…" }, "note": "…" },
  "nonClaims": {
    "localizationNotExploitability": true,
    "needsHuman": true,
    "noAurocFileF1OrgLatencySla": true,
    "ciBadgeNotVulnProof": true,
    "diptychGradesSeparately": true,
    "sampleGradeIllustrative": true
  }
}`;

const EXPECTED_KEYS = [
  { key: "schemaVersion", note: "zeroday-stranger-verify/v1" },
  { key: "doorA", note: "ran: true · status pass · artifact paths" },
  { key: "doorB.mode", note: '"citation" · ran: false · no live GPU' },
  { key: "nonClaims", note: "honest flags — not AUROC / vuln proof" },
] as const;

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
] as const;

/**
 * Prove doors — browser surface for stranger Door A (keyless verify) + Door B
 * (citation to gpu-claims Live re-proof). No one-click GPU. No invented metrics.
 * Desk has no shell-out for npm scripts; copy-paste + static `--json` schema
 * preview (same CLI / CI artifact stranger-verify-json).
 */
export function ProveDoorsPanel() {
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
          . Door A runs keyless locally ($0). Door B is a citation to a dated
          measured session — this panel never provisions pods or invents AUROC /
          F1 / SLAs.
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
            <Badge tone="warn">citation only</Badge>
          </div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            <strong className="text-[var(--text)]/85 font-medium">
              Not run here.
            </strong>{" "}
            Cite the dated operator re-proof — invent nothing beyond what{" "}
            <code className="text-[var(--accent)]">docs/gpu-claims.md</code>{" "}
            already records.
          </p>
          <ul className="mt-3 text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4 font-mono">
            {DOOR_B_FACTS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="panel rounded-lg p-4">
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <Terminal size={14} /> Run Door A in your terminal
          </span>
          <Badge tone="muted">copy-paste</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Desk does not shell out to npm scripts (Commands tab wraps in-process
          libs only). Paste this in the repo root — same command as CI:
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
          optional{" "}
          <code className="text-[var(--accent)]">
            npm run stranger:verify -- --mvp
          </code>{" "}
          to run fixture locate first.
        </p>
      </div>

      <div
        className="panel rounded-lg p-4"
        data-testid="prove-doors-json-card"
      >
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <Code2 size={14} /> Machine-readable Door A card
          </span>
          <Badge tone="muted">--json · copy-paste</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Static schema preview only — this panel does not run the CLI, invent
          metrics, or call live Antares. Paste in the repo root (prefer{" "}
          <code className="text-[var(--accent)]">--silent</code> so npm’s banner
          does not precede the JSON). CI uploads the same shape as artifact{" "}
          <code className="text-[var(--accent)]">stranger-verify-json</code>.
        </p>
        <CopyCommand
          command={VERIFY_JSON_CMD}
          ariaLabel="Copy stranger:verify --json command"
          testId="prove-doors-copy-json"
        />
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Example shape (not live output)
            </div>
            <pre
              className={cn(
                "rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
                "px-3 py-2 text-[11px] font-mono text-[var(--muted)] overflow-x-auto",
                "leading-relaxed whitespace-pre-wrap",
              )}
              data-testid="prove-doors-json-example"
            >
              {JSON_EXAMPLE}
            </pre>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Expected keys
            </div>
            <ul
              className="text-[11px] font-mono space-y-1.5 text-[var(--muted)]"
              data-testid="prove-doors-json-keys"
            >
              {EXPECTED_KEYS.map((k) => (
                <li key={k.key}>
                  <code className="text-[var(--accent)]">{k.key}</code>
                  <span className="text-[var(--muted)]"> — {k.note}</span>
                </li>
              ))}
            </ul>
            <div
              className="mt-3 rounded-md border border-[var(--warn)]/30 bg-[var(--warn)]/5 px-3 py-2"
              data-testid="prove-doors-json-non-claims"
            >
              <div className="text-[10px] uppercase tracking-wider text-[var(--warn)] mb-1 flex items-center gap-1.5">
                <ShieldAlert size={12} /> Non-claims (next to JSON)
              </div>
              <ul className="text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4">
                {NON_CLAIMS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-2">
              Detail:{" "}
              <a
                href="https://github.com/pandeyaby/ZERODAY/blob/main/docs/stranger-verify.md#machine-readable-json---json"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline font-mono inline-flex items-center gap-1"
              >
                docs/stranger-verify.md § --json
                <ExternalLink size={10} className="opacity-70" />
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="panel rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
          Docs
        </div>
        <ul className="space-y-2">
          {DOC_LINKS.map((d) => (
            <li key={d.href} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
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
