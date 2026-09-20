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
  Download,
  ExternalLink,
  FileJson,
  Loader2,
  Play,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  downloadGpuEvidenceJson,
  GPU_EVIDENCE_DOWNLOAD_FILENAME,
  serializeGpuEvidenceJson,
} from "@/desk/gpu-evidence-download";
import {
  downloadProveDoorsJson,
  PROVE_DOORS_DOWNLOAD_FILENAME,
  serializeProveDoorsJson,
} from "@/desk/prove-doors-download";

const VERIFY_CMD = "npm run stranger:verify";
const VERIFY_ALIAS = "npm run doors";
/** Prefer --silent so npm’s script banner does not precede the JSON. */
const VERIFY_JSON_CMD = "npm run --silent stranger:verify -- --json";
const API_PATH = "/api/stranger-verify";
const LIVE_URL_PROBE_API_PATH = "/api/live-url-probe";
const CASSETTE_API_PATH = "/api/cassette-replay";
const PROVE_ALL_API_PATH = "/api/prove-doors";
const GPU_EVIDENCE_API_PATH = "/api/gpu-evidence";
const UPLOAD_SARIF_API_PATH = "/api/upload-sarif";
const CASSETTE_CMD = "npm run cassette:replay";
const UPLOAD_SARIF_DRY_CMD =
  "npm run upload-sarif -- --sarif <path> --dry-run";

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
  {
    href: "https://github.com/pandeyaby/ZERODAY/blob/main/docs/gpu-claims.md#live-locate-2026-09-1920-pt",
    label: "docs/gpu-claims.md § Live locate (2026-09-19/20)",
    hint: "Measured A40 evidence JSON — historical only; Desk GET /api/gpu-evidence",
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

type LiveUrlProbeJson = {
  schemaVersion?: string;
  ok?: boolean;
  mode?: string;
  provisioned?: boolean;
  spendUsd?: number | null;
  probe?: {
    ok?: boolean;
    httpStatus?: number | null;
    latencyMs?: number | null;
    modelCount?: number | null;
    detail?: string;
    modelsUrl?: string;
  };
  error?: string;
  code?: string;
};

type ProveAllDoorEntry = {
  status?: "ok" | "failed" | "skipped";
  label?: string;
  door?: string;
  error?: string;
  code?: string;
  reason?: string;
  result?: unknown;
};

type ProveAllJson = {
  schemaVersion?: string;
  ok?: boolean;
  generatedAt?: string;
  doors?: {
    a?: ProveAllDoorEntry;
    cassette?: ProveAllDoorEntry;
    b?: ProveAllDoorEntry;
    d?: ProveAllDoorEntry;
    e?: ProveAllDoorEntry;
  };
  nonClaims?: unknown;
  error?: string;
};

type GpuEvidenceJson = {
  schemaVersion?: string;
  ok?: boolean;
  source?: string;
  historical?: boolean;
  startsRunPod?: boolean;
  evidence?: {
    kind?: string;
    label?: string;
    session?: string;
    measured?: boolean;
    pod?: {
      id?: string;
      tier?: string;
      gpu?: string;
      dataCenter?: string;
      rateUsdPerHourAtCreate?: number;
    };
    spend?: {
      estimatedUsd?: number;
      formula?: string;
      billingApiSettled?: boolean;
      label?: string;
    };
    liveLocate?: {
      rankedFile?: string;
      rank?: number;
      terminalCallsUsed?: number;
      toolBudget?: number;
      sarifResults?: number;
      cwe?: string;
    };
    non_claims?: string[];
  };
  nonClaims?: unknown;
  error?: string;
  code?: string;
};

type UploadSarifDryJson = {
  schemaVersion?: string;
  ok?: boolean;
  dryRun?: boolean;
  sarifPath?: string;
  source?: string;
  message?: string;
  payload?: {
    endpoint?: string;
    method?: string;
    dryRun?: boolean;
    body?: {
      commit_sha?: string;
      ref?: string;
      tool_name?: string;
    };
    sarifBytes?: number;
    posture?: {
      localizationOnly?: boolean;
      notExploitProof?: boolean;
      requiresSecurityEventsWrite?: boolean;
    };
  };
  nonClaims?: unknown;
  error?: string;
  code?: string;
};

/**
 * Prove doors — browser surface for stranger Door A (keyless verify) + Door B
 * (citation + dedicated live-url probe) + Keyless K3 cassette:replay +
 * Measured A40 evidence (GET /api/gpu-evidence, historical read-only) +
 * Run all doors orchestrator (POST /api/prove-doors; includes Door D historical A40 evidence + Door E upload-sarif dry-run) +
 * Code Scanning upload dry-run (POST /api/upload-sarif — never GitHub from Desk).
 * Door B probe → POST /api/live-url-probe (fail-closed). No one-click GPU.
 */
export function ProveDoorsPanel() {
  const [liveUrl, setLiveUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProveDoorsJson | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<LiveUrlProbeJson | null>(
    null,
  );
  const [cassetteBusy, setCassetteBusy] = useState(false);
  const [cassetteError, setCassetteError] = useState<string | null>(null);
  const [cassetteResult, setCassetteResult] =
    useState<CassetteReplayJson | null>(null);
  const [allBusy, setAllBusy] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [allResult, setAllResult] = useState<ProveAllJson | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(true);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<GpuEvidenceJson | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadSarifDryJson | null>(
    null,
  );
  const [sarifPathInput, setSarifPathInput] = useState("");

  const anyBusy =
    busy || probeBusy || cassetteBusy || allBusy || uploadBusy;

  useEffect(() => {
    let cancelled = false;
    setEvidenceBusy(true);
    setEvidenceError(null);
    void (async () => {
      try {
        const res = await fetch(GPU_EVIDENCE_API_PATH);
        const json = (await res.json()) as GpuEvidenceJson;
        if (cancelled) return;
        if (!res.ok) {
          setEvidenceError(json.error || `HTTP ${res.status}`);
          setEvidence(null);
        } else {
          setEvidence(json);
        }
      } catch (e) {
        if (!cancelled) {
          setEvidenceError((e as Error).message);
          setEvidence(null);
        }
      } finally {
        if (!cancelled) setEvidenceBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runVerify = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Door A path — citation Door B (live probe has its own card / API).
      const res = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
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
  }, []);

  const runLiveUrlProbe = useCallback(async () => {
    setProbeBusy(true);
    setProbeError(null);
    setProbeResult(null);
    try {
      const trimmed = liveUrl.trim();
      if (!trimmed) {
        setProbeError("liveUrl is required for Door B probe");
        return;
      }
      const res = await fetch(LIVE_URL_PROBE_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveUrl: trimmed }),
      });
      const json = (await res.json()) as LiveUrlProbeJson;
      if (!res.ok) {
        setProbeError(json.error || `HTTP ${res.status}`);
        setProbeResult(json.probe ? json : null);
      } else {
        setProbeResult(json);
      }
    } catch (e) {
      setProbeError((e as Error).message);
      setProbeResult(null);
    } finally {
      setProbeBusy(false);
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

  const runAllDoors = useCallback(async () => {
    setAllBusy(true);
    setAllError(null);
    setAllResult(null);
    try {
      const trimmed = liveUrl.trim();
      const body = trimmed ? { liveUrl: trimmed } : {};
      const res = await fetch(PROVE_ALL_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ProveAllJson;
      if (!res.ok && json.error && !json.doors) {
        setAllError(json.error || `HTTP ${res.status}`);
        setAllResult(null);
      } else {
        setAllResult(json);
        if (json.ok === false) {
          setAllError(null);
        }
      }
    } catch (e) {
      setAllError((e as Error).message);
      setAllResult(null);
    } finally {
      setAllBusy(false);
    }
  }, [liveUrl]);

  const runUploadSarifDryRun = useCallback(async () => {
    setUploadBusy(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const trimmed = sarifPathInput.trim();
      const body = trimmed
        ? { sarifPath: trimmed }
        : { fixture: true };
      const res = await fetch(UPLOAD_SARIF_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as UploadSarifDryJson;
      if (!res.ok) {
        setUploadError(json.error || `HTTP ${res.status}`);
        setUploadResult(null);
      } else {
        setUploadResult(json);
      }
    } catch (e) {
      setUploadError((e as Error).message);
      setUploadResult(null);
    } finally {
      setUploadBusy(false);
    }
  }, [sarifPathInput]);

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
          . Door A runs keyless locally ($0). Door B defaults to a citation; use
          the live-url probe card for your OpenAI-compatible{" "}
          <code className="text-[var(--accent)]">/v1</code> (
          <code className="text-[var(--accent)]">GET /v1/models</code> only) —
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
            <Badge tone="warn">citation · live-url probe</Badge>
          </div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Default is citation only — invent nothing beyond what{" "}
            <code className="text-[var(--accent)]">docs/gpu-claims.md</code>{" "}
            already records. Live-url probe validates{" "}
            <em>your</em> endpoint only (
            <code className="text-[var(--accent)]">provisioned: false</code> ·
            fail-closed · not A40 re-proof).
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
        data-testid="prove-doors-run-all-card"
      >
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <Play size={14} /> Run all doors
          </span>
          <Badge tone="ok">POST {PROVE_ALL_API_PATH}</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Orchestrates Door A (<code className="text-[var(--accent)]">stranger:verify</code>
          ), <code className="text-[var(--accent)]">cassette:replay</code>, Door D
          (Measured A40 evidence, historical), Door E (upload-sarif dry-run), and
          optional Door B live-url probe in-process. Aggregated JSON with per-door
          status. Door B is{" "}
          <code className="text-[var(--accent)]">skipped</code> (not failed)
          when liveUrl is empty. Door D + Door E are required (checked-in evidence
          — D does not start RunPod; E = dry-run Code Scanning check, not live
          upload). Fail-closed per door · no spend invented.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            type="button"
            size="md"
            disabled={anyBusy}
            onClick={() => void runAllDoors()}
            data-testid="prove-doors-run-all"
            aria-label="Run all prove doors via Desk API"
          >
            {allBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {allBusy ? "Running all…" : "Run all doors"}
          </Button>
          <span className="text-[11px] text-[var(--muted)]">
            Uses liveUrl below when set · otherwise Door B skipped
          </span>
        </div>
        {allError ? (
          <p
            className="mt-3 text-sm text-[var(--danger)]"
            data-testid="prove-doors-run-all-error"
            role="alert"
          >
            {allError}
          </p>
        ) : null}
        {allResult ? (
          <div className="mt-3" data-testid="prove-doors-run-all-result">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone={allResult.ok === false ? "warn" : "ok"}>
                {String(allResult.schemaVersion ?? "prove-doors")}
              </Badge>
              <Badge tone={allResult.ok ? "ok" : "warn"}>
                ok: {String(allResult.ok)}
              </Badge>
              {allResult.doors?.a?.status ? (
                <Badge tone="muted">a: {allResult.doors.a.status}</Badge>
              ) : null}
              {allResult.doors?.cassette?.status ? (
                <Badge tone="muted">
                  cassette: {allResult.doors.cassette.status}
                </Badge>
              ) : null}
              {allResult.doors?.b?.status ? (
                <Badge tone="muted">b: {allResult.doors.b.status}</Badge>
              ) : null}
              {allResult.doors?.d?.status ? (
                <Badge tone="muted">d: {allResult.doors.d.status}</Badge>
              ) : null}
              {allResult.doors?.e?.status ? (
                <Badge tone="muted">e: {allResult.doors.e.status}</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  downloadProveDoorsJson(allResult, {
                    filename: PROVE_DOORS_DOWNLOAD_FILENAME,
                  });
                }}
                data-testid="prove-doors-run-all-download"
                aria-label={`Download ${PROVE_DOORS_DOWNLOAD_FILENAME}`}
              >
                <Download size={14} />
                Download {PROVE_DOORS_DOWNLOAD_FILENAME}
              </Button>
              <CopyJsonButton
                value={serializeProveDoorsJson(allResult)}
                ariaLabel={`Copy ${PROVE_DOORS_DOWNLOAD_FILENAME} JSON`}
                testId="prove-doors-run-all-copy"
              />
              <span className="text-[11px] text-[var(--muted)]">
                Same shape as CLI{" "}
                <code className="text-[var(--accent)]">--out</code> / CI
                artifact
              </span>
            </div>
            <pre
              className={cn(
                "rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
                "px-3 py-2 text-[11px] font-mono text-[var(--muted)] overflow-x-auto",
                "leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto",
              )}
              data-testid="prove-doors-run-all-json"
            >
              {JSON.stringify(allResult, null, 2)}
            </pre>
          </div>
        ) : null}
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
          ). Door B stays citation-only here — use the live-url probe card for
          operator endpoint checks.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            type="button"
            size="md"
            disabled={anyBusy}
            onClick={() => void runVerify()}
            data-testid="prove-doors-run"
            aria-label="Run stranger verify via Desk API"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {busy ? "Running…" : "Run Door A"}
          </Button>
          <span className="text-[11px] text-[var(--muted)]">
            Door A keyless · Door B citation in returned JSON
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
              <Badge tone="muted">Door B citation</Badge>
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
        data-testid="prove-doors-door-b-card"
      >
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <Play size={14} /> Run Door B live-url probe
          </span>
          <Badge tone="warn">POST {LIVE_URL_PROBE_API_PATH}</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Operator-supplied OpenAI-compatible{" "}
          <code className="text-[var(--accent)]">/v1</code> →{" "}
          <code className="text-[var(--accent)]">GET /v1/models</code> only.
          Returns real status / latencyMs / modelCount. Fail-closed on
          unreachable or non-200.{" "}
          <strong className="text-[var(--text)]/85 font-medium">
            Probe ≠ measured A40 re-proof
          </strong>{" "}
          · <code className="text-[var(--accent)]">provisioned: false</code> ·{" "}
          <code className="text-[var(--accent)]">spendUsd: null</code> · no
          RunPod create.
        </p>
        <label className="block text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
          liveUrl (required · OpenAI-compatible /v1)
        </label>
        <input
          type="url"
          value={liveUrl}
          onChange={(e) => setLiveUrl(e.target.value)}
          placeholder="http://127.0.0.1:8000/v1"
          className={cn(
            "w-full rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
            "px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--muted)]",
            "focus:outline-none focus:border-[var(--accent)]",
          )}
          data-testid="prove-doors-live-url"
          disabled={probeBusy || allBusy}
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            type="button"
            size="md"
            disabled={anyBusy || !liveUrl.trim()}
            onClick={() => void runLiveUrlProbe()}
            data-testid="prove-doors-door-b-run"
            aria-label="Run Door B live-url probe via Desk API"
          >
            {probeBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {probeBusy ? "Probing…" : "Run Door B probe"}
          </Button>
          <span className="text-[11px] text-[var(--muted)]">
            No spend claims · not A40 re-proof
          </span>
        </div>
        {probeError ? (
          <p
            className="mt-3 text-sm text-[var(--danger)]"
            data-testid="prove-doors-door-b-error"
            role="alert"
          >
            {probeError}
          </p>
        ) : null}
        {probeResult ? (
          <div className="mt-3" data-testid="prove-doors-door-b-result">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone={probeResult.ok === false ? "warn" : "ok"}>
                {String(probeResult.schemaVersion ?? "probe")}
              </Badge>
              {typeof probeResult.probe?.httpStatus === "number" ? (
                <Badge tone="muted">
                  status: {probeResult.probe.httpStatus}
                </Badge>
              ) : probeResult.probe?.httpStatus === null ? (
                <Badge tone="warn">status: unreachable</Badge>
              ) : null}
              {typeof probeResult.probe?.latencyMs === "number" ? (
                <Badge tone="muted">
                  latencyMs: {probeResult.probe.latencyMs}
                </Badge>
              ) : null}
              {typeof probeResult.probe?.modelCount === "number" ? (
                <Badge tone="muted">
                  modelCount: {probeResult.probe.modelCount}
                </Badge>
              ) : null}
              <Badge tone="muted">
                provisioned: {String(probeResult.provisioned ?? false)}
              </Badge>
              <Badge tone="muted">
                spendUsd: {String(probeResult.spendUsd ?? null)}
              </Badge>
            </div>
            <pre
              className={cn(
                "rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
                "px-3 py-2 text-[11px] font-mono text-[var(--muted)] overflow-x-auto",
                "leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto",
              )}
              data-testid="prove-doors-door-b-json"
            >
              {JSON.stringify(probeResult, null, 2)}
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
            disabled={anyBusy}
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

      <div
        className="panel rounded-lg p-4"
        data-testid="prove-doors-upload-sarif-card"
      >
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <Code2 size={14} /> Dry-run Code Scanning upload
          </span>
          <Badge tone="ok">POST {UPLOAD_SARIF_API_PATH}</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Validates a SARIF path (or fixture sample) and returns the dry-run
          request JSON —{" "}
          <strong className="text-[var(--text)]/85 font-medium">
            never calls GitHub from Desk
          </strong>
          . Live upload stays CLI (
          <code className="text-[var(--accent)]">{UPLOAD_SARIF_DRY_CMD}</code>
          ; omit <code className="text-[var(--accent)]">--dry-run</code> +{" "}
          <code className="text-[var(--accent)]">security_events: write</code>
          ). Fail-closed on missing/invalid SARIF. Localization only — not
          exploit proof.
        </p>
        <label className="block text-[11px] text-[var(--muted)] mb-1">
          sarifPath (optional — empty uses fixture sample)
        </label>
        <input
          type="text"
          value={sarifPathInput}
          onChange={(e) => setSarifPathInput(e.target.value)}
          placeholder="fixtures/locate/ingest-sample/sample.sarif"
          disabled={anyBusy}
          className={cn(
            "w-full mb-3 rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
            "px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--muted)]",
            "focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
          )}
          data-testid="prove-doors-upload-sarif-path"
          aria-label="SARIF path for Code Scanning dry-run"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="md"
            disabled={anyBusy}
            onClick={() => void runUploadSarifDryRun()}
            data-testid="prove-doors-upload-sarif-run"
            aria-label="Dry-run Code Scanning SARIF upload via Desk API"
          >
            {uploadBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Code2 size={14} />
            )}
            {uploadBusy ? "Validating…" : "Dry-run Code Scanning upload"}
          </Button>
          <span className="text-[11px] text-[var(--muted)]">
            Desk dry-run only · no network · no live upload
          </span>
        </div>
        {uploadError ? (
          <p
            className="mt-3 text-sm text-[var(--danger)]"
            data-testid="prove-doors-upload-sarif-error"
            role="alert"
          >
            {uploadError}
          </p>
        ) : null}
        {uploadResult ? (
          <div className="mt-3" data-testid="prove-doors-upload-sarif-result">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone={uploadResult.ok === false ? "warn" : "ok"}>
                {String(uploadResult.schemaVersion ?? "upload-sarif-desk")}
              </Badge>
              {uploadResult.dryRun === true ? (
                <Badge tone="muted">dryRun</Badge>
              ) : null}
              {uploadResult.source ? (
                <Badge tone="muted">source: {uploadResult.source}</Badge>
              ) : null}
              {uploadResult.payload?.endpoint ? (
                <Badge tone="muted">{uploadResult.payload.endpoint}</Badge>
              ) : null}
            </div>
            <pre
              className={cn(
                "rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
                "px-3 py-2 text-[11px] font-mono text-[var(--muted)] overflow-x-auto",
                "leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto",
              )}
              data-testid="prove-doors-upload-sarif-json"
            >
              {JSON.stringify(uploadResult, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      <div
        className="panel rounded-lg p-4"
        data-testid="prove-doors-a40-evidence-card"
      >
        <div className="panel-header !px-0 !pt-0 !border-0">
          <span className="text-sm font-display tracking-wide flex items-center gap-2">
            <FileJson size={14} /> Measured A40 evidence
          </span>
          <Badge tone="muted">GET {GPU_EVIDENCE_API_PATH}</Badge>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2 mb-3">
          Historical measured session from checked-in{" "}
          <code className="text-[var(--accent)]">
            docs/reports/a40-live-locate-20260920.json
          </code>
          . Read-only · not a live probe · not an SLA ·{" "}
          <strong className="text-[var(--text)]/85 font-medium">
            this card does not start RunPod
          </strong>
          . Cite only fields in the JSON — no AUROC / File-F1 invented.
        </p>
        {evidenceBusy ? (
          <p
            className="text-sm text-[var(--muted)] flex items-center gap-2"
            data-testid="prove-doors-a40-evidence-loading"
          >
            <Loader2 size={14} className="animate-spin" /> Loading evidence…
          </p>
        ) : null}
        {evidenceError ? (
          <p
            className="mt-1 text-sm text-[var(--danger)]"
            data-testid="prove-doors-a40-evidence-error"
            role="alert"
          >
            {evidenceError}
          </p>
        ) : null}
        {evidence?.evidence ? (
          <div className="mt-1" data-testid="prove-doors-a40-evidence-result">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone="ok">
                {String(evidence.schemaVersion ?? "evidence")}
              </Badge>
              <Badge tone="warn">historical measured</Badge>
              <Badge tone="muted">
                startsRunPod: {String(evidence.startsRunPod ?? false)}
              </Badge>
            </div>
            <ul
              className="text-[11px] font-mono space-y-1.5 text-[var(--muted)] mb-3"
              data-testid="prove-doors-a40-evidence-fields"
            >
              <li>
                <span className="text-[var(--text)]/80">pod id</span>
                {" — "}
                {evidence.evidence.pod?.id ?? "—"}
                {evidence.evidence.pod?.gpu
                  ? ` · ${evidence.evidence.pod.gpu}`
                  : ""}
              </li>
              <li>
                <span className="text-[var(--text)]/80">est USD</span>
                {" — "}
                {typeof evidence.evidence.spend?.estimatedUsd === "number"
                  ? `$${evidence.evidence.spend.estimatedUsd}`
                  : "—"}
                {evidence.evidence.spend?.formula
                  ? ` (${evidence.evidence.spend.formula})`
                  : ""}
              </li>
              <li>
                <span className="text-[var(--text)]/80">ranked file</span>
                {" — "}
                {evidence.evidence.liveLocate?.rankedFile ?? "—"}
                {typeof evidence.evidence.liveLocate?.rank === "number"
                  ? ` · rank ${evidence.evidence.liveLocate.rank}`
                  : ""}
              </li>
              <li>
                <span className="text-[var(--text)]/80">tool calls</span>
                {" — "}
                {typeof evidence.evidence.liveLocate?.terminalCallsUsed ===
                "number"
                  ? evidence.evidence.liveLocate.terminalCallsUsed
                  : "—"}
                {typeof evidence.evidence.liveLocate?.toolBudget === "number"
                  ? ` / budget ${evidence.evidence.liveLocate.toolBudget}`
                  : ""}
              </li>
              <li>
                <span className="text-[var(--text)]/80">SARIF count</span>
                {" — "}
                {typeof evidence.evidence.liveLocate?.sarifResults === "number"
                  ? evidence.evidence.liveLocate.sarifResults
                  : "—"}
              </li>
            </ul>
            {Array.isArray(evidence.evidence.non_claims) &&
            evidence.evidence.non_claims.length > 0 ? (
              <ul
                className="text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4 mb-3"
                data-testid="prove-doors-a40-evidence-non-claims"
              >
                {evidence.evidence.non_claims.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  downloadGpuEvidenceJson(evidence, {
                    filename: GPU_EVIDENCE_DOWNLOAD_FILENAME,
                  });
                }}
                data-testid="prove-doors-a40-evidence-download"
                aria-label={`Download ${GPU_EVIDENCE_DOWNLOAD_FILENAME}`}
              >
                <Download size={14} />
                Download {GPU_EVIDENCE_DOWNLOAD_FILENAME}
              </Button>
              <CopyJsonButton
                value={serializeGpuEvidenceJson(evidence)}
                ariaLabel={`Copy ${GPU_EVIDENCE_DOWNLOAD_FILENAME} JSON`}
                testId="prove-doors-a40-evidence-copy"
              />
              <span className="text-[11px] text-[var(--muted)]">
                Same shape as CLI{" "}
                <code className="text-[var(--accent)]">--out</code> / CI
                artifact · historical only · does not start RunPod
              </span>
            </div>
            <pre
              className={cn(
                "rounded-md border border-[var(--line)] bg-[var(--bg-2)]",
                "px-3 py-2 text-[11px] font-mono text-[var(--muted)] overflow-x-auto",
                "leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto",
              )}
              data-testid="prove-doors-a40-evidence-json"
            >
              {JSON.stringify(evidence, null, 2)}
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

function CopyJsonButton({
  value,
  ariaLabel,
  testId,
}: {
  value: string;
  ariaLabel: string;
  testId: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      type="button"
      className="shrink-0"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
      {copied ? "Copied" : "Copy JSON"}
    </Button>
  );
}
