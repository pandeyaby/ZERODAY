/**
 * Client-side prove-doors.json download helpers.
 *
 * Serializes the last Desk Run-all / POST /api/prove-doors response to the same
 * pretty JSON shape as CLI `prove-doors --out prove-doors.json` / CI artifact
 * (zeroday-prove-doors/v1). No server write — browser download only.
 *
 * Kept free of Node-only desk imports so the Prove doors panel ("use client")
 * can import this module safely.
 */

/** Same schema id as `PROVE_DOORS_SCHEMA` in src/desk/prove-doors.ts. */
export const PROVE_DOORS_DOWNLOAD_SCHEMA = "zeroday-prove-doors/v1" as const;

/** Filename matching CLI `--out` / CI artifact upload path. */
export const PROVE_DOORS_DOWNLOAD_FILENAME = "prove-doors.json" as const;

export type ProveDoorsDownloadPayload = {
  schemaVersion?: string;
  ok?: boolean;
  generatedAt?: string;
  doors?: unknown;
  nonClaims?: unknown;
  error?: string;
  [key: string]: unknown;
};

export type DownloadProveDoorsDeps = {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  createElement?: Document["createElement"];
  appendChild?: (el: HTMLElement) => void;
  removeChild?: (el: HTMLElement) => void;
};

/**
 * Pretty-print prove-doors payload (trailing newline) — same as CLI `--out`.
 */
export function serializeProveDoorsJson(
  payload: ProveDoorsDownloadPayload | unknown,
): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Trigger a browser download of prove-doors.json from an in-memory payload.
 * Returns the filename + serialized text for tests / callers.
 */
export function downloadProveDoorsJson(
  payload: ProveDoorsDownloadPayload | unknown,
  options?: {
    filename?: string;
    deps?: DownloadProveDoorsDeps;
  },
): {
  filename: string;
  text: string;
  schemaHint: typeof PROVE_DOORS_DOWNLOAD_SCHEMA;
} {
  const filename = options?.filename ?? PROVE_DOORS_DOWNLOAD_FILENAME;
  const text = serializeProveDoorsJson(payload);
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
  a.setAttribute("data-testid", "prove-doors-download-anchor");

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
    schemaHint: PROVE_DOORS_DOWNLOAD_SCHEMA,
  };
}
