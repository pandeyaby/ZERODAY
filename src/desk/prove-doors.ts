/**
 * Desk Prove Run-all-doors orchestrator — Door A + cassette:replay + optional Door B.
 *
 * Reuses in-process runners (no HTTP fan-out). Fail-closed per door: one failure
 * does not invent success for others; overall `ok` is true only when every
 * non-skipped door succeeded. Door B is `skipped` (not failed) when liveUrl omitted.
 * Never invents spend / AUROC / provision. No RunPod create.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runCassetteReplay,
  CassetteReplayError,
  CASSETTE_REPLAY_SCHEMA,
  type CassetteReplayOptions,
  type CassetteReplayResult,
} from "./cassette-replay";
import {
  runLiveUrlProbe,
  LiveUrlProbeError,
  LIVE_URL_PROBE_SCHEMA,
  type LiveUrlProbeResult,
} from "./live-url-probe";
import {
  runStrangerVerify,
  StrangerVerifyError,
  STRANGER_VERIFY_SCHEMA,
  type StrangerVerifyOptions,
  type StrangerVerifyResult,
  type StrangerVerifyProbe,
} from "./stranger-verify";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROVE_DOORS_REPO_ROOT = path.resolve(HERE, "../..");

export const PROVE_DOORS_SCHEMA = "zeroday-prove-doors/v1" as const;

export type ProveDoorStatus = "ok" | "failed" | "skipped";

export interface ProveDoorAEntry {
  status: "ok" | "failed";
  label: "a";
  door: "Door A — stranger:verify";
  schemaVersion: typeof STRANGER_VERIFY_SCHEMA;
  result?: StrangerVerifyResult;
  error?: string;
  code?: string;
}

export interface ProveDoorCassetteEntry {
  status: "ok" | "failed";
  label: "cassette";
  door: "cassette:replay";
  schemaVersion: typeof CASSETTE_REPLAY_SCHEMA;
  result?: CassetteReplayResult;
  error?: string;
  code?: string;
  exit?: number;
}

export interface ProveDoorBOk {
  status: "ok";
  label: "b";
  door: "Door B — live-url probe";
  schemaVersion: typeof LIVE_URL_PROBE_SCHEMA;
  result: LiveUrlProbeResult;
}

export interface ProveDoorBFailed {
  status: "failed";
  label: "b";
  door: "Door B — live-url probe";
  schemaVersion: typeof LIVE_URL_PROBE_SCHEMA;
  error: string;
  code?: string;
  provisioned: false;
  spendUsd: null;
  probe?: StrangerVerifyProbe;
}

export interface ProveDoorBSkipped {
  status: "skipped";
  label: "b";
  door: "Door B — live-url probe";
  schemaVersion: typeof LIVE_URL_PROBE_SCHEMA;
  reason: "liveUrl omitted";
  note: string;
  provisioned: false;
  spendUsd: null;
}

export type ProveDoorBEntry =
  | ProveDoorBOk
  | ProveDoorBFailed
  | ProveDoorBSkipped;

export interface ProveDoorsNonClaims {
  localizationNotExploitability: true;
  needsHuman: true;
  noAurocFileF1OrgLatencySla: true;
  ciBadgeNotVulnProof: true;
  probeNotMeasuredA40ReProof: true;
  noRunPodCreateFromProveDoors: true;
  noSpendClaimsInvented: true;
  failClosedPerDoor: true;
}

export interface ProveDoorsResult {
  schemaVersion: typeof PROVE_DOORS_SCHEMA;
  ok: boolean;
  generatedAt: string;
  doors: {
    a: ProveDoorAEntry;
    cassette: ProveDoorCassetteEntry;
    b: ProveDoorBEntry;
  };
  nonClaims: ProveDoorsNonClaims;
}

export interface ProveDoorsOptions {
  /** Opt-in Door B. Omitted / blank → doors.b.status = "skipped" (not failed). */
  liveUrl?: string;
  /** Temp / override output for Door A trust-loop artifacts. */
  strangerOutputDir?: string;
  /** Cassette overrides (same as POST /api/cassette-replay). */
  recording?: string;
  cassetteOutputDir?: string;
  expectFindings?: number;
  expectFile?: string;
  expectCwe?: string;
  cwd?: string;
  /** Inject fetch for Door B tests (mock live URL). */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const NON_CLAIMS: ProveDoorsNonClaims = {
  localizationNotExploitability: true,
  needsHuman: true,
  noAurocFileF1OrgLatencySla: true,
  ciBadgeNotVulnProof: true,
  probeNotMeasuredA40ReProof: true,
  noRunPodCreateFromProveDoors: true,
  noSpendClaimsInvented: true,
  failClosedPerDoor: true,
};

async function runDoorA(
  opts: ProveDoorsOptions,
  cwd: string,
): Promise<ProveDoorAEntry> {
  const base: Omit<ProveDoorAEntry, "status" | "result" | "error" | "code"> = {
    label: "a",
    door: "Door A — stranger:verify",
    schemaVersion: STRANGER_VERIFY_SCHEMA,
  };
  try {
    const svOpts: StrangerVerifyOptions = {
      cwd,
      // Citation-only Door B inside stranger:verify — live probe is doors.b.
      outputDir: opts.strangerOutputDir,
    };
    const result = await runStrangerVerify(svOpts);
    return { ...base, status: "ok", result };
  } catch (e) {
    const err = e as Error;
    const isSv = err instanceof StrangerVerifyError;
    return {
      ...base,
      status: "failed",
      error: err.message,
      code: isSv ? (err as StrangerVerifyError).code : undefined,
    };
  }
}

async function runDoorCassette(
  opts: ProveDoorsOptions,
  cwd: string,
): Promise<ProveDoorCassetteEntry> {
  const base: Omit<
    ProveDoorCassetteEntry,
    "status" | "result" | "error" | "code" | "exit"
  > = {
    label: "cassette",
    door: "cassette:replay",
    schemaVersion: CASSETTE_REPLAY_SCHEMA,
  };
  try {
    const crOpts: CassetteReplayOptions = {
      cwd,
      recording: opts.recording,
      outputDir: opts.cassetteOutputDir,
      expectFindings: opts.expectFindings,
      expectFile: opts.expectFile,
      expectCwe: opts.expectCwe,
    };
    const result = await runCassetteReplay(crOpts);
    return { ...base, status: "ok", result };
  } catch (e) {
    const err = e as Error;
    const isCr = err instanceof CassetteReplayError;
    return {
      ...base,
      status: "failed",
      error: err.message,
      code: isCr ? (err as CassetteReplayError).code : undefined,
      exit: isCr ? (err as CassetteReplayError).exit : 2,
    };
  }
}

async function runDoorB(
  opts: ProveDoorsOptions,
): Promise<ProveDoorBEntry> {
  const liveUrl = opts.liveUrl?.trim();
  if (!liveUrl) {
    return {
      status: "skipped",
      label: "b",
      door: "Door B — live-url probe",
      schemaVersion: LIVE_URL_PROBE_SCHEMA,
      reason: "liveUrl omitted",
      note: "Door B skipped (not failed) — provide liveUrl for GET /v1/models probe; citation-only otherwise. provisioned:false · spendUsd:null · not A40 re-proof.",
      provisioned: false,
      spendUsd: null,
    };
  }

  try {
    const result = await runLiveUrlProbe({
      liveUrl,
      fetchImpl: opts.fetchImpl,
      timeoutMs: opts.timeoutMs,
    });
    return {
      status: "ok",
      label: "b",
      door: "Door B — live-url probe",
      schemaVersion: LIVE_URL_PROBE_SCHEMA,
      result,
    };
  } catch (e) {
    const err = e as Error;
    const isProbe = err instanceof LiveUrlProbeError;
    return {
      status: "failed",
      label: "b",
      door: "Door B — live-url probe",
      schemaVersion: LIVE_URL_PROBE_SCHEMA,
      error: err.message,
      code: isProbe ? (err as LiveUrlProbeError).code : undefined,
      provisioned: false,
      spendUsd: null,
      ...(isProbe && (err as LiveUrlProbeError).probe
        ? { probe: (err as LiveUrlProbeError).probe }
        : {}),
    };
  }
}

/**
 * Run all Desk Prove doors in-process. Per-door fail-closed; Door B skipped
 * without liveUrl. overall ok iff every non-skipped door has status "ok".
 */
export async function runProveDoors(
  opts: ProveDoorsOptions = {},
): Promise<ProveDoorsResult> {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : PROVE_DOORS_REPO_ROOT;

  // Sequential: reuse existing modules; avoid concurrent temp-dir contention.
  const a = await runDoorA(opts, cwd);
  const cassette = await runDoorCassette(opts, cwd);
  const b = await runDoorB(opts);

  const doors = { a, cassette, b };
  const ok =
    a.status === "ok" &&
    cassette.status === "ok" &&
    (b.status === "ok" || b.status === "skipped");

  return {
    schemaVersion: PROVE_DOORS_SCHEMA,
    ok,
    generatedAt: new Date().toISOString(),
    doors,
    nonClaims: NON_CLAIMS,
  };
}

export function proveDoorsCatalog() {
  return {
    kind: "prove-doors-catalog" as const,
    schemaVersion: PROVE_DOORS_SCHEMA,
    endpoint: "POST /api/prove-doors",
    doors: {
      a: {
        label: "Door A — stranger:verify",
        via: "runStrangerVerify",
        api: "POST /api/stranger-verify",
      },
      cassette: {
        label: "cassette:replay",
        via: "runCassetteReplay",
        api: "POST /api/cassette-replay",
      },
      b: {
        label: "Door B — live-url probe",
        via: "runLiveUrlProbe",
        api: "POST /api/live-url-probe",
        skippedWhen: "liveUrl omitted",
      },
    },
    body: {
      liveUrl: {
        optional: true,
        description:
          "OpenAI-compatible /v1 — runs Door B; omit → doors.b.status=skipped (not failed)",
      },
      recording: { optional: true, description: "Cassette path override" },
      expectFindings: { optional: true },
      expectFile: { optional: true },
      expectCwe: { optional: true },
    },
    returns: {
      ok: "true iff every non-skipped door ok",
      generatedAt: "ISO-8601",
      doors: "{ a, cassette, b }",
    },
    honesty: [
      "needs_human · localization ≠ exploitability",
      "fail-closed per door · never invent spend / AUROC",
      "Door B skipped (not failed) when liveUrl omitted",
      "probe ≠ measured Secure A40 re-proof · provisioned: false",
      "no RunPod create / no HF pull from prove-doors",
    ],
  };
}
