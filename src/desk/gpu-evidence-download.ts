/**
 * Client-side gpu-evidence.json download helpers.
 *
 * Serializes the Desk GET /api/gpu-evidence response to the same pretty JSON
 * shape as CLI `gpu-evidence --out gpu-evidence.json` / CI artifact
 * (zeroday-gpu-evidence/v1). No server write — browser download only.
 * Historical measured session only — does not start RunPod.
 *
 * Kept free of Node-only desk imports so the Prove doors panel ("use client")
 * can import this module safely.
 */

/** Same schema id as `GPU_EVIDENCE_SCHEMA` in src/desk/gpu-evidence.ts. */
export const GPU_EVIDENCE_DOWNLOAD_SCHEMA = "zeroday-gpu-evidence/v1" as const;

/** Filename matching CLI `--out` / CI artifact upload path. */
export const GPU_EVIDENCE_DOWNLOAD_FILENAME = "gpu-evidence.json" as const;

export type GpuEvidenceDownloadPayload = {
  schemaVersion?: string;
  ok?: boolean;
  source?: string;
  historical?: boolean;
  startsRunPod?: boolean;
  evidence?: unknown;
  nonClaims?: unknown;
  error?: string;
  [key: string]: unknown;
};

export type DownloadGpuEvidenceDeps = {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  createElement?: Document["createElement"];
  appendChild?: (el: HTMLElement) => void;
  removeChild?: (el: HTMLElement) => void;
};

/**
 * Pretty-print gpu-evidence payload (trailing newline) — same as CLI `--out`.
 */
export function serializeGpuEvidenceJson(
  payload: GpuEvidenceDownloadPayload | unknown,
): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Trigger a browser download of gpu-evidence.json from an in-memory payload.
 * Returns the filename + serialized text for tests / callers.
 */
export function downloadGpuEvidenceJson(
  payload: GpuEvidenceDownloadPayload | unknown,
  options?: {
    filename?: string;
    deps?: DownloadGpuEvidenceDeps;
  },
): {
  filename: string;
  text: string;
  schemaHint: typeof GPU_EVIDENCE_DOWNLOAD_SCHEMA;
} {
  const filename = options?.filename ?? GPU_EVIDENCE_DOWNLOAD_FILENAME;
  const text = serializeGpuEvidenceJson(payload);
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
  a.setAttribute("data-testid", "gpu-evidence-download-anchor");

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
    schemaHint: GPU_EVIDENCE_DOWNLOAD_SCHEMA,
  };
}
