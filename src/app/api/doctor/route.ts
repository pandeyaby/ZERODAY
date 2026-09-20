/**
 * GET/POST /api/doctor — Desk workstation readiness (zeroday.doctor/v1).
 *
 * Calls existing `runDoctor` in-process. Fail-closed. Historical / local
 * only — never starts RunPod / no GPU spend / no network. Returns the same
 * JSON shape as CLI `doctor --json` / `--out out/doctor.json`.
 */

import { NextResponse } from "next/server";
import {
  runDoctor,
  doctorCatalog,
  DOCTOR_SCHEMA,
} from "@/doctor";

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
  "endpoint",
  "liveUrl",
] as const;

function doctorErrorBody(message: string, code?: string) {
  return {
    ok: false as const,
    error: message,
    ...(code ? { code } : {}),
    schemaVersion: DOCTOR_SCHEMA,
    runpod: false as const,
    startsRunPod: false as const,
    networkRequired: false as const,
  };
}

function runDoctorResponse() {
  try {
    const result = runDoctor();
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(doctorErrorBody(err.message, "DOCTOR_FAILED"), {
      status: 500,
    });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("catalog") === "1") {
    return NextResponse.json(doctorCatalog());
  }
  // GET without catalog runs doctor (same as POST) — downloadable JSON.
  return runDoctorResponse();
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        doctorErrorBody(
          'Expected JSON body (optional empty object "{}")',
          "BAD_JSON",
        ),
        { status: 400 },
      );
    }
  }

  for (const key of Object.keys(body)) {
    if ((BANNED_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json(
        doctorErrorBody(
          `Refusing secret/provision field "${key}" — doctor never provisions or accepts secrets`,
          "SECRET_FIELD_REFUSED",
        ),
        { status: 403 },
      );
    }
  }

  return runDoctorResponse();
}
