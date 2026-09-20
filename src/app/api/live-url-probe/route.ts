/**
 * GET/POST /api/live-url-probe — Desk Prove Door B live-url probe.
 *
 * POST body required `{ "liveUrl": "https://…/v1" }`.
 * Runs GET /v1/models only · provisioned:false · spendUsd:null.
 * Fail-closed: HTTP 502 on unreachable / non-200 (never invents success).
 * Never RunPod create / HF weight pull. Probe ≠ measured A40 re-proof.
 */

import { NextResponse } from "next/server";
import {
  runLiveUrlProbe,
  liveUrlProbeCatalog,
  LiveUrlProbeError,
} from "@/desk/live-url-probe";

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

export async function GET() {
  return NextResponse.json(liveUrlProbeCatalog());
}

export async function POST(req: Request) {
  let body: { liveUrl?: unknown } = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as { liveUrl?: unknown };
    } catch {
      return NextResponse.json(
        {
          error: 'Expected JSON body { "liveUrl": "https://…/v1" }',
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
          error: `Refusing secret/provision field "${key}" — liveUrl probe is GET /v1/models only`,
          code: "SECRET_FIELD_REFUSED",
          ok: false,
        },
        { status: 403 },
      );
    }
  }

  if (body.liveUrl === undefined || body.liveUrl === null) {
    return NextResponse.json(
      {
        error: "liveUrl is required",
        code: "LIVE_URL_REQUIRED",
        ok: false,
      },
      { status: 400 },
    );
  }
  if (typeof body.liveUrl !== "string") {
    return NextResponse.json(
      {
        error: "liveUrl must be a string URL",
        code: "LIVE_URL_TYPE",
        ok: false,
      },
      { status: 400 },
    );
  }

  try {
    const result = await runLiveUrlProbe({ liveUrl: body.liveUrl });
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    const isProbe = err instanceof LiveUrlProbeError;
    const code = isProbe ? (err as LiveUrlProbeError).code : undefined;
    const probe = isProbe ? (err as LiveUrlProbeError).probe : undefined;
    const status =
      code === "PROBE_UNREACHABLE" || code === "PROBE_HTTP_FAILED"
        ? 502
        : isProbe
          ? 400
          : 500;
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        code,
        schemaVersion: "zeroday-live-url-probe/v1",
        provisioned: false,
        spendUsd: null,
        ...(probe
          ? {
              probe: {
                modelsUrl: probe.modelsUrl,
                endpoint: probe.endpoint,
                ok: probe.ok,
                httpStatus: probe.httpStatus,
                latencyMs: probe.latencyMs,
                modelCount: probe.modelCount,
                detail: probe.detail,
                provisioned: false as const,
                spendUsd: null,
                mode: probe.mode,
              },
            }
          : {}),
      },
      { status },
    );
  }
}
