/**
 * GET/POST /api/prove-doors — Desk Prove Run-all-doors orchestrator.
 *
 * Runs Door A (stranger:verify), cassette:replay, Door D (Measured A40
 * evidence, historical), Door E (upload-sarif dry-run on fixture), and
 * optionally Door B (live-url) in-process. Returns aggregated JSON:
 *   { schemaVersion, ok, generatedAt, doors: { a, cassette, b, d, e }, nonClaims }
 * Door B skipped (not failed) when liveUrl omitted. Door D + Door E required
 * for ok. Fail-closed per door. Never invents spend / metrics. No RunPod
 * create — Door D loads checked-in evidence only (not live GPU).
 * Door E = dry-run Code Scanning check, not live upload.
 */

import { NextResponse } from "next/server";
import {
  runProveDoors,
  proveDoorsCatalog,
  PROVE_DOORS_REPO_ROOT,
} from "@/desk/prove-doors";
import {
  assertAllowedReadPath,
  PathPolicyError,
} from "@/lib/path-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProveDoorsBody = {
  liveUrl?: unknown;
  recording?: unknown;
  outputDir?: unknown;
  cassetteOutputDir?: unknown;
  strangerOutputDir?: unknown;
  expectFindings?: unknown;
  expectFile?: unknown;
  expectCwe?: unknown;
};

const BANNED_KEYS = [
  "token",
  "apiKey",
  "api_key",
  "secret",
  "password",
  "authorization",
  "hfToken",
  "runpodApiKey",
  "RUNPOD_API_KEY",
  "HF_TOKEN",
] as const;

function optionalString(
  value: unknown,
  field: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string` };
  }
  const trimmed = value.trim();
  return { ok: true, value: trimmed || undefined };
}

function optionalPositiveInt(
  value: unknown,
  field: string,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
    return { ok: false, error: `${field} must be a positive integer` };
  }
  return { ok: true, value: n };
}

/** Fail-closed Desk read allowlist for optional client path fields. */
function gateOptionalPath(
  value: string | undefined,
  label: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (!value) return { ok: true, value: undefined };
  try {
    return {
      ok: true,
      value: assertAllowedReadPath(PROVE_DOORS_REPO_ROOT, value, { label }),
    };
  } catch (e) {
    if (e instanceof PathPolicyError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}

export async function GET() {
  return NextResponse.json(proveDoorsCatalog());
}

export async function POST(req: Request) {
  let body: ProveDoorsBody = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as ProveDoorsBody;
    } catch {
      return NextResponse.json(
        {
          error:
            'Expected JSON body (optional { "liveUrl", "recording", "expectFindings", "expectFile", "expectCwe" })',
          ok: false,
        },
        { status: 400 },
      );
    }
  }

  for (const key of Object.keys(body as object)) {
    if ((BANNED_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json(
        {
          error: `Refusing secret/provision field "${key}" — prove-doors never provisions or accepts secrets`,
          code: "SECRET_FIELD_REFUSED",
          ok: false,
        },
        { status: 403 },
      );
    }
  }

  const liveUrl = optionalString(body.liveUrl, "liveUrl");
  if (!liveUrl.ok) {
    return NextResponse.json(
      { error: liveUrl.error, code: "FIELD_TYPE", ok: false },
      { status: 400 },
    );
  }
  const recording = optionalString(body.recording, "recording");
  if (!recording.ok) {
    return NextResponse.json(
      { error: recording.error, code: "FIELD_TYPE", ok: false },
      { status: 400 },
    );
  }
  const cassetteOutputDir = optionalString(
    body.cassetteOutputDir ?? body.outputDir,
    "cassetteOutputDir",
  );
  if (!cassetteOutputDir.ok) {
    return NextResponse.json(
      { error: cassetteOutputDir.error, code: "FIELD_TYPE", ok: false },
      { status: 400 },
    );
  }
  const strangerOutputDir = optionalString(
    body.strangerOutputDir,
    "strangerOutputDir",
  );
  if (!strangerOutputDir.ok) {
    return NextResponse.json(
      { error: strangerOutputDir.error, code: "FIELD_TYPE", ok: false },
      { status: 400 },
    );
  }
  const expectFile = optionalString(body.expectFile, "expectFile");
  if (!expectFile.ok) {
    return NextResponse.json(
      { error: expectFile.error, code: "FIELD_TYPE", ok: false },
      { status: 400 },
    );
  }
  const expectCwe = optionalString(body.expectCwe, "expectCwe");
  if (!expectCwe.ok) {
    return NextResponse.json(
      { error: expectCwe.error, code: "FIELD_TYPE", ok: false },
      { status: 400 },
    );
  }
  const expectFindings = optionalPositiveInt(
    body.expectFindings,
    "expectFindings",
  );
  if (!expectFindings.ok) {
    return NextResponse.json(
      { error: expectFindings.error, code: "FIELD_TYPE", ok: false },
      { status: 400 },
    );
  }

  const recordingPath = gateOptionalPath(recording.value, "recording");
  if (!recordingPath.ok) {
    return NextResponse.json(
      { error: recordingPath.error, code: "PATH_POLICY", ok: false },
      { status: 400 },
    );
  }
  // Output dirs are write targets (may be tmp) — gate only read inputs here.
  // cassetteOutputDir / strangerOutputDir stay optional overrides without
  // package-root allowlist (runners still resolve under cwd).

  try {
    const result = await runProveDoors({
      liveUrl: liveUrl.value,
      recording: recordingPath.value,
      cassetteOutputDir: cassetteOutputDir.value,
      strangerOutputDir: strangerOutputDir.value,
      expectFindings: expectFindings.value,
      expectFile: expectFile.value,
      expectCwe: expectCwe.value,
    });
    // Always 200 with structured per-door status (fail-closed in payload).
    // Client inspects result.ok / doors.*.status — do not invent success.
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    if (err instanceof PathPolicyError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          code: "PATH_POLICY",
          schemaVersion: "zeroday-prove-doors/v1",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        schemaVersion: "zeroday-prove-doors/v1",
      },
      { status: 500 },
    );
  }
}
