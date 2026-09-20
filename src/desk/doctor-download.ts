/**
 * Client-side doctor.json download helpers.
 *
 * Serializes the Desk GET/POST /api/doctor response to the same pretty JSON
 * shape as CLI `doctor --out out/doctor.json` / CI artifact
 * (zeroday.doctor/v1). No server write — browser download only.
 * Historical / local only — does not start RunPod.
 *
 * Kept free of Node-only desk imports so the Prove doors panel ("use client")
 * can import this module safely.
 */

/** Same schema id as `DOCTOR_SCHEMA` in src/doctor/workstation.ts. */
export const DOCTOR_DOWNLOAD_SCHEMA = "zeroday.doctor/v1" as const;

/** Filename matching CLI `--out` / CI artifact upload path. */
export const DOCTOR_DOWNLOAD_FILENAME = "doctor.json" as const;

export type DoctorDownloadPayload = {
  schemaVersion?: string;
  ok?: boolean;
  checks?: unknown;
  runpod?: boolean;
  startsRunPod?: boolean;
  networkRequired?: boolean;
  error?: string;
  [key: string]: unknown;
};

export type DownloadDoctorDeps = {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  createElement?: Document["createElement"];
  appendChild?: (el: HTMLElement) => void;
  removeChild?: (el: HTMLElement) => void;
};

/**
 * Pretty-print doctor payload (trailing newline) — same as CLI `--out`.
 */
export function serializeDoctorJson(
  payload: DoctorDownloadPayload | unknown,
): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Trigger a browser download of doctor.json from an in-memory payload.
 * Returns the filename + serialized text for tests / callers.
 */
export function downloadDoctorJson(
  payload: DoctorDownloadPayload | unknown,
  options?: {
    filename?: string;
    deps?: DownloadDoctorDeps;
  },
): {
  filename: string;
  text: string;
  schemaHint: typeof DOCTOR_DOWNLOAD_SCHEMA;
} {
  const filename = options?.filename ?? DOCTOR_DOWNLOAD_FILENAME;
  const text = serializeDoctorJson(payload);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });

  const createObjectURL =
    options?.deps?.createObjectURL ??
    ((b: Blob) => URL.createObjectURL(b));
  const revokeObjectURL =
    options?.deps?.revokeObjectURL ??
    ((u: string) => URL.revokeObjectURL(u));

  const url = createObjectURL(blob);
  const createElement =
    options?.deps?.createElement ??
    ((tag: string) => document.createElement(tag));
  const a = createElement("a") as HTMLAnchorElement;
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.setAttribute("data-testid", "doctor-download-anchor");

  if (options?.deps?.appendChild) {
    options.deps.appendChild(a);
  } else if (typeof document !== "undefined" && document.body) {
    document.body.appendChild(a);
  }

  a.click();

  if (options?.deps?.removeChild) {
    options.deps.removeChild(a);
  } else if (a.parentNode) {
    a.parentNode.removeChild(a);
  }

  revokeObjectURL(url);

  return {
    filename,
    text,
    schemaHint: DOCTOR_DOWNLOAD_SCHEMA,
  };
}
