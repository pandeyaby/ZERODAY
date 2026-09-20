/**
 * GET/POST /api/cassette-replay — Desk Prove doors cassette:replay runner.
 *
 * POST body optional overrides for recording / expect pins.
 * Returns pinned prove JSON (mode, findingCount, rankedFile, sarifResultCount, exit).
 * Fail-closed on assert mismatch (HTTP 422, exit 2). No GPU / RunPod.
 */

import { NextResponse } from "next/server";
import {
  runCassetteReplay,
  cassetteReplayCatalog,
  CassetteReplayError,
} from "@/desk/cassette-replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CassetteReplayBody = {
  recording?: unknown;
  outputDir?: unknown;
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
  "liveUrl",
  "endpoint",
] as const;

function optionalString(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new CassetteReplayError(
      `${field} must be a string`,
      "FIELD_TYPE",
    );
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalPositiveInt(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
    throw new CassetteReplayError(
      `${field} must be a positive integer`,
      "FIELD_TYPE",
    );
  }
  return n;
}

export async function GET() {
  return NextResponse.json(cassetteReplayCatalog());
}

export async function POST(req: Request) {
  let body: CassetteReplayBody = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as CassetteReplayBody;
    } catch {
      return NextResponse.json(
        {
          error:
            'Expected JSON body (optional { "recording", "expectFindings", "expectFile", "expectCwe" })',
          exit: 2,
        },
        { status: 400 },
      );
    }
  }

  for (const key of Object.keys(body as object)) {
    if ((BANNED_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json(
        {
          error: `Refusing field "${key}" — cassette:replay is offline Keyless K3 only`,
          code: "SECRET_FIELD_REFUSED",
          exit: 2,
        },
        { status: 403 },
      );
    }
  }

  try {
    const recording = optionalString(body.recording, "recording");
    const outputDir = optionalString(body.outputDir, "outputDir");
    const expectFile = optionalString(body.expectFile, "expectFile");
    const expectCwe = optionalString(body.expectCwe, "expectCwe");
    const expectFindings = optionalPositiveInt(
      body.expectFindings,
      "expectFindings",
    );

    const result = await runCassetteReplay({
      recording,
      outputDir,
      expectFindings,
      expectFile,
      expectCwe,
    });
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    const isCr = err instanceof CassetteReplayError;
    const code = isCr ? (err as CassetteReplayError).code : undefined;
    const exit = isCr ? (err as CassetteReplayError).exit : 2;
    const status =
      code === "ASSERT_MISMATCH" || code === "MODE_MISMATCH"
        ? 422
        : isCr
          ? 400
          : 500;
    return NextResponse.json(
      {
        ok: false,
        exit,
        error: err.message,
        code,
        schemaVersion: "zeroday-cassette-replay/v1",
      },
      { status },
    );
  }
}
