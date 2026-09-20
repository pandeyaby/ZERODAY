/**
 * GET/POST /api/prove-doors — Desk Prove Run-all-doors orchestrator.
 *
 * Runs Door A (stranger:verify), cassette:replay, and optionally Door B
 * (live-url) in-process. Returns aggregated JSON:
 *   { schemaVersion, ok, generatedAt, doors: { a, cassette, b }, nonClaims }
 * Door B skipped (not failed) when liveUrl omitted.
 * Fail-closed per door. Never invents spend / metrics. No RunPod create.
 */

import { NextResponse } from "next/server";
import {
  runProveDoors,
  proveDoorsCatalog,
} from "@/desk/prove-doors";

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

  try {
    const result = await runProveDoors({
      liveUrl: liveUrl.value,
      recording: recording.value,
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
