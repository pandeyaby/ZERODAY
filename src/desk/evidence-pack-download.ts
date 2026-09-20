/**
 * Client-side evidence-pack download helpers.
 *
 * Serializes Desk POST /api/evidence-pack pack files to the same pretty JSON
 * / markdown shape as CLI `evidence-pack --out out/evidence/` (`manifest.json`,
 * `prove-doors.json`, `gpu-evidence.json`, `report.json`, `report.md`).
 * Browser download only — no server write from the client. Historical
 * gpu-evidence only — does not start RunPod.
 *
 * Kept free of Node-only desk imports so the Prove doors panel ("use client")
 * can import this module safely.
 */

/** Same schema id as `EVIDENCE_PACK_SCHEMA` in src/locate/evidence-pack.ts. */
export const EVIDENCE_PACK_DOWNLOAD_SCHEMA = "zeroday.evidence_pack/v1" as const;

/** Filenames matching CLI `out/evidence/` layout. */
export const EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME = "manifest.json" as const;
export const EVIDENCE_PACK_PROVE_DOORS_DOWNLOAD_FILENAME =
  "prove-doors.json" as const;
export const EVIDENCE_PACK_GPU_EVIDENCE_DOWNLOAD_FILENAME =
  "gpu-evidence.json" as const;
export const EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME = "report.json" as const;
export const EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME = "report.md" as const;

export const EVIDENCE_PACK_DOWNLOAD_FILENAMES = [
  EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME,
  EVIDENCE_PACK_PROVE_DOORS_DOWNLOAD_FILENAME,
  EVIDENCE_PACK_GPU_EVIDENCE_DOWNLOAD_FILENAME,
  EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME,
  EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME,
] as const;

export type EvidencePackDownloadFiles = {
  [EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME]?: unknown;
  [EVIDENCE_PACK_PROVE_DOORS_DOWNLOAD_FILENAME]?: unknown;
  [EVIDENCE_PACK_GPU_EVIDENCE_DOWNLOAD_FILENAME]?: unknown;
  [EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME]?: unknown;
  [EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME]?: unknown;
  [key: string]: unknown;
};

export type EvidencePackDownloadPayload = {
  schemaVersion?: string;
  ok?: boolean;
  historicalGpuEvidenceOnly?: boolean;
  startsRunPod?: boolean;
  defaultOut?: string;
  files?: EvidencePackDownloadFiles;
  manifest?: unknown;
  proveDoors?: unknown;
  gpuEvidence?: unknown;
  report?: unknown;
  reportMarkdown?: unknown;
  error?: string;
  [key: string]: unknown;
};

export type DownloadEvidencePackDeps = {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  createElement?: Document["createElement"];
  appendChild?: (el: HTMLElement) => void;
  removeChild?: (el: HTMLElement) => void;
};

/**
 * Pretty-print pack JSON (trailing newline) — same as CLI `--out` writes.
 */
export function serializeEvidencePackJson(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Markdown body for report.md (string payload from API).
 */
export function serializeEvidencePackMarkdown(payload: unknown): string {
  if (typeof payload !== "string" || !payload.trim()) {
    throw new Error("evidence-pack download report.md requires markdown string");
  }
  return payload.endsWith("\n") ? payload : `${payload}\n`;
}

/**
 * Resolve CLI-shaped pack files from an API (or assembled) payload.
 */
export function resolveEvidencePackFiles(
  payload: EvidencePackDownloadPayload | unknown,
): {
  [EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME]: unknown;
  [EVIDENCE_PACK_PROVE_DOORS_DOWNLOAD_FILENAME]: unknown;
  [EVIDENCE_PACK_GPU_EVIDENCE_DOWNLOAD_FILENAME]: unknown;
  [EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME]: unknown;
  [EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME]: string;
} {
  const p = (payload ?? {}) as EvidencePackDownloadPayload;
  const files = (p.files ?? {}) as EvidencePackDownloadFiles;
  const manifest =
    files[EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME] ?? p.manifest;
  const proveDoors =
    files[EVIDENCE_PACK_PROVE_DOORS_DOWNLOAD_FILENAME] ?? p.proveDoors;
  const gpuEvidence =
    files[EVIDENCE_PACK_GPU_EVIDENCE_DOWNLOAD_FILENAME] ?? p.gpuEvidence;
  const report =
    files[EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME] ?? p.report;
  const reportMdRaw =
    files[EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME] ?? p.reportMarkdown;

  if (manifest === undefined) {
    throw new Error("evidence-pack download missing manifest.json");
  }
  if (proveDoors === undefined) {
    throw new Error("evidence-pack download missing prove-doors.json");
  }
  if (gpuEvidence === undefined) {
    throw new Error("evidence-pack download missing gpu-evidence.json");
  }
  if (report === undefined) {
    throw new Error("evidence-pack download missing report.json");
  }
  if (typeof reportMdRaw !== "string" || !reportMdRaw.trim()) {
    throw new Error("evidence-pack download missing report.md");
  }

  return {
    [EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME]: manifest,
    [EVIDENCE_PACK_PROVE_DOORS_DOWNLOAD_FILENAME]: proveDoors,
    [EVIDENCE_PACK_GPU_EVIDENCE_DOWNLOAD_FILENAME]: gpuEvidence,
    [EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME]: report,
    [EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME]: reportMdRaw,
  };
}

function isMarkdownFilename(filename: string): boolean {
  return filename === EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME;
}

/**
 * Trigger a browser download of one pack file (JSON or markdown).
 */
export function downloadEvidencePackFile(
  payload: unknown,
  options?: {
    filename?: string;
    deps?: DownloadEvidencePackDeps;
    testId?: string;
  },
): {
  filename: string;
  text: string;
  schemaHint: typeof EVIDENCE_PACK_DOWNLOAD_SCHEMA;
} {
  const filename =
    options?.filename ?? EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME;
  const text = isMarkdownFilename(filename)
    ? serializeEvidencePackMarkdown(payload)
    : serializeEvidencePackJson(payload);
  const mime = isMarkdownFilename(filename)
    ? "text/markdown;charset=utf-8"
    : "application/json;charset=utf-8";
  const blob = new Blob([text], { type: mime });

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
  a.setAttribute(
    "data-testid",
    options?.testId ?? "evidence-pack-download-anchor",
  );

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
    schemaHint: EVIDENCE_PACK_DOWNLOAD_SCHEMA,
  };
}

/**
 * Download all CLI `out/evidence/` files (manifest + prove-doors +
 * gpu-evidence + report.json + report.md). Returns per-file filename + text
 * for tests / callers.
 */
export function downloadEvidencePackFiles(
  payload: EvidencePackDownloadPayload | unknown,
  options?: {
    deps?: DownloadEvidencePackDeps;
  },
): {
  files: Array<{
    filename: string;
    text: string;
  }>;
  schemaHint: typeof EVIDENCE_PACK_DOWNLOAD_SCHEMA;
} {
  const resolved = resolveEvidencePackFiles(payload);
  const files = EVIDENCE_PACK_DOWNLOAD_FILENAMES.map((filename) => {
    const anchorSuffix = filename.replace(/\.(json|md)$/, "");
    const result = downloadEvidencePackFile(resolved[filename], {
      filename,
      deps: options?.deps,
      testId: `evidence-pack-download-anchor-${anchorSuffix}`,
    });
    return { filename: result.filename, text: result.text };
  });

  return {
    files,
    schemaHint: EVIDENCE_PACK_DOWNLOAD_SCHEMA,
  };
}
