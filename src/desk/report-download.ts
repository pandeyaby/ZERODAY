/**
 * Client-side report.json / report.md download helpers.
 *
 * Serializes the Desk GET/POST /api/report response to the same pretty JSON
 * / markdown shape as CLI `zeroday report --out out/report.json|report.md`
 * (zeroday.report/v1). No server write — browser download only.
 * Localization only — does not start RunPod.
 *
 * Kept free of Node-only desk imports so the Prove doors panel ("use client")
 * can import this module safely.
 */

/** Same schema id as `REPORT_SCHEMA` in src/locate/report-summary.ts. */
export const REPORT_DOWNLOAD_SCHEMA = "zeroday.report/v1" as const;

/** Filenames matching CLI `--out` defaults. */
export const REPORT_JSON_DOWNLOAD_FILENAME = "report.json" as const;
export const REPORT_MD_DOWNLOAD_FILENAME = "report.md" as const;

export const REPORT_DOWNLOAD_FILENAMES = [
  REPORT_JSON_DOWNLOAD_FILENAME,
  REPORT_MD_DOWNLOAD_FILENAME,
] as const;

export type ReportDownloadPayload = {
  schemaVersion?: string;
  ok?: boolean;
  generated_at?: string;
  sources?: unknown;
  findings?: unknown;
  disclaimers?: unknown;
  runpod?: boolean;
  startsRunPod?: boolean;
  whatWasRun?: unknown;
  gpuFootnote?: unknown;
  markdown?: string;
  source?: string;
  error?: string;
  [key: string]: unknown;
};

export type DownloadReportDeps = {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  createElement?: Document["createElement"];
  appendChild?: (el: HTMLElement) => void;
  removeChild?: (el: HTMLElement) => void;
};

/**
 * Strip Desk-only wrapper fields before writing report.json
 * (CLI --out is pure zeroday.report/v1).
 */
export function stripReportDownloadEnvelope(
  payload: ReportDownloadPayload | unknown,
): Record<string, unknown> {
  const p = (payload ?? {}) as ReportDownloadPayload;
  const {
    ok: _ok,
    markdown: _md,
    source: _source,
    startsRunPod: _srp,
    error: _err,
    code: _code,
    ...rest
  } = p;
  return rest as Record<string, unknown>;
}

/**
 * Pretty-print report payload (trailing newline) — same as CLI `--out` JSON.
 */
export function serializeReportJson(
  payload: ReportDownloadPayload | unknown,
): string {
  return `${JSON.stringify(stripReportDownloadEnvelope(payload), null, 2)}\n`;
}

/**
 * Markdown body: prefer API `markdown` field; otherwise empty fail-closed.
 */
export function serializeReportMarkdown(
  payload: ReportDownloadPayload | unknown,
): string {
  const p = (payload ?? {}) as ReportDownloadPayload;
  if (typeof p.markdown === "string" && p.markdown.trim()) {
    return p.markdown.endsWith("\n") ? p.markdown : `${p.markdown}\n`;
  }
  throw new Error(
    "report.md download requires markdown field from /api/report",
  );
}

function downloadBlob(
  text: string,
  options: {
    filename: string;
    mime: string;
    deps?: DownloadReportDeps;
    testId: string;
  },
): { filename: string; text: string } {
  const blob = new Blob([text], { type: options.mime });

  const createObjectURL =
    options.deps?.createObjectURL ?? ((b: Blob) => URL.createObjectURL(b));
  const revokeObjectURL =
    options.deps?.revokeObjectURL ?? ((u: string) => URL.revokeObjectURL(u));

  const url = createObjectURL(blob);
  const createElement =
    options.deps?.createElement ??
    ((tag: string) => document.createElement(tag));
  const a = createElement("a") as HTMLAnchorElement;
  a.href = url;
  a.download = options.filename;
  a.rel = "noopener";
  a.setAttribute("data-testid", options.testId);

  if (options.deps?.appendChild) {
    options.deps.appendChild(a);
  } else if (typeof document !== "undefined" && document.body) {
    document.body.appendChild(a);
  }

  a.click();

  if (options.deps?.removeChild) {
    options.deps.removeChild(a);
  } else if (a.parentNode) {
    a.parentNode.removeChild(a);
  }

  revokeObjectURL(url);

  return { filename: options.filename, text };
}

/**
 * Trigger a browser download of report.json from an in-memory payload.
 */
export function downloadReportJson(
  payload: ReportDownloadPayload | unknown,
  options?: {
    filename?: string;
    deps?: DownloadReportDeps;
  },
): {
  filename: string;
  text: string;
  schemaHint: typeof REPORT_DOWNLOAD_SCHEMA;
} {
  const filename = options?.filename ?? REPORT_JSON_DOWNLOAD_FILENAME;
  const text = serializeReportJson(payload);
  const result = downloadBlob(text, {
    filename,
    mime: "application/json;charset=utf-8",
    deps: options?.deps,
    testId: "report-json-download-anchor",
  });
  return {
    ...result,
    schemaHint: REPORT_DOWNLOAD_SCHEMA,
  };
}

/**
 * Trigger a browser download of report.md (requires markdown on payload).
 */
export function downloadReportMarkdown(
  payload: ReportDownloadPayload | unknown,
  options?: {
    filename?: string;
    deps?: DownloadReportDeps;
  },
): {
  filename: string;
  text: string;
  schemaHint: typeof REPORT_DOWNLOAD_SCHEMA;
} {
  const filename = options?.filename ?? REPORT_MD_DOWNLOAD_FILENAME;
  const text = serializeReportMarkdown(payload);
  const result = downloadBlob(text, {
    filename,
    mime: "text/markdown;charset=utf-8",
    deps: options?.deps,
    testId: "report-md-download-anchor",
  });
  return {
    ...result,
    schemaHint: REPORT_DOWNLOAD_SCHEMA,
  };
}

/**
 * Download both report.json and report.md (when markdown is present).
 */
export function downloadReportFiles(
  payload: ReportDownloadPayload | unknown,
  options?: {
    deps?: DownloadReportDeps;
  },
): {
  files: Array<{ filename: string; text: string }>;
  schemaHint: typeof REPORT_DOWNLOAD_SCHEMA;
} {
  const json = downloadReportJson(payload, { deps: options?.deps });
  const files = [{ filename: json.filename, text: json.text }];
  const p = (payload ?? {}) as ReportDownloadPayload;
  if (typeof p.markdown === "string" && p.markdown.trim()) {
    const md = downloadReportMarkdown(payload, { deps: options?.deps });
    files.push({ filename: md.filename, text: md.text });
  }
  return { files, schemaHint: REPORT_DOWNLOAD_SCHEMA };
}
