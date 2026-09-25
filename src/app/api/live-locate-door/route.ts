/**
 * GET/POST /api/live-locate-door — Desk Prove Door F live-locate.
 *
 * POST body required `{ "endpoint": "http://127.0.0.1:…/v1" }`.
 * Runs locate (tool-calls → SARIF) against operator OpenAI-compatible /v1.
 * Fail-closed: HTTP 400 on missing URL / chat shape; 502 on unreachable.
 * Default mockAntares:true (no GPU / HF weights). Never RunPod create.
 * Door F ≠ measured A40 re-proof · provisioned:false · spendUsd:null.
 */

import { NextResponse } from "next/server";
import {
  runLiveLocateDoor,
  liveLocateDoorCatalog,
  LiveLocateDoorError,
} from "@/desk/live-locate-door";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type Body = {
  endpoint?: unknown;
  liveLocateUrl?: unknown;
  model?: unknown;
  cwe?: unknown;
  repo?: unknown;
  outputDir?: unknown;
  mockAntares?: unknown;
  remoteInference?: unknown;
};

export async function GET() {
  return NextResponse.json(liveLocateDoorCatalog());
}

export async function POST(req: Request) {
  let body: Body = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as Body;
    } catch {
      return NextResponse.json(
        {
          error:
            'Expected JSON body { "endpoint": "http://127.0.0.1:8000/v1" }',
          code: "BODY_PARSE",
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
          error: `Refusing secret/provision field "${key}" — live-locate-door never accepts secrets`,
          code: "SECRET_FIELD_REFUSED",
          ok: false,
        },
        { status: 403 },
      );
    }
  }

  const endpointRaw = body.endpoint ?? body.liveLocateUrl;
  if (endpointRaw === undefined || endpointRaw === null) {
    return NextResponse.json(
      {
        error:
          "endpoint is required — OpenAI-compatible /v1 for live locate (tool-calls → SARIF)",
        code: "LIVE_URL_REQUIRED",
        ok: false,
        provisioned: false,
        spendUsd: null,
      },
      { status: 400 },
    );
  }
  if (typeof endpointRaw !== "string") {
    return NextResponse.json(
      {
        error: "endpoint must be a string URL",
        code: "ENDPOINT_TYPE",
        ok: false,
      },
      { status: 400 },
    );
  }

  const model =
    typeof body.model === "string" ? body.model.trim() || undefined : undefined;
  const cwe =
    typeof body.cwe === "string" ? body.cwe.trim() || undefined : undefined;
  const repo =
    typeof body.repo === "string" ? body.repo.trim() || undefined : undefined;
  const outputDir =
    typeof body.outputDir === "string"
      ? body.outputDir.trim() || undefined
      : undefined;
  const mockAntares =
    body.mockAntares === undefined ? true : body.mockAntares === true;
  const remoteInference = body.remoteInference === true;

  try {
    const result = await runLiveLocateDoor({
      endpoint: endpointRaw,
      model,
      cwe,
      repo,
      outputDir,
      mockAntares,
      remoteInference,
    });
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    const isDoor = err instanceof LiveLocateDoorError;
    const code = isDoor ? (err as LiveLocateDoorError).code : undefined;
    const status =
      code === "ENDPOINT_UNREACHABLE"
        ? 502
        : code === "LIVE_URL_REQUIRED" ||
            code === "ENDPOINT_SHAPE" ||
            code === "TOOL_CALLS_MISSING" ||
            code === "SARIF_EMPTY" ||
            code === "SARIF_MISSING" ||
            code === "SARIF_INVALID" ||
            code === "RANKED_EMPTY" ||
            code === "MODE_MISMATCH" ||
            code === "REPO_MISSING"
          ? 400
          : isDoor
            ? 400
            : 500;
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        code,
        schemaVersion: "zeroday-live-locate-door/v1",
        provisioned: false,
        spendUsd: null,
      },
      { status },
    );
  }
}
