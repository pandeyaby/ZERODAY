/**
 * Client-side report.json / report.md download helper — serialize + download wiring.
 * Matches CLI `zeroday report --out` / Desk /api/report shape.
 * Localization only — does not start RunPod.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadReportFiles,
  downloadReportJson,
  downloadReportMarkdown,
  REPORT_DOWNLOAD_FILENAMES,
  REPORT_DOWNLOAD_SCHEMA,
  REPORT_JSON_DOWNLOAD_FILENAME,
  REPORT_MD_DOWNLOAD_FILENAME,
  serializeReportJson,
  serializeReportMarkdown,
  stripReportDownloadEnvelope,
} from "../../src/desk/report-download.ts";
import { REPORT_SCHEMA } from "../../src/locate/report-summary.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SAMPLE_PAYLOAD = {
  ok: true,
  source: "fixture",
  startsRunPod: false,
  markdown: "# ZERODAY localization summary\n\n> **Localization only.**\n",
  schemaVersion: REPORT_DOWNLOAD_SCHEMA,
  generated_at: "2026-09-20T12:00:00.000Z",
  sources: [
    {
      kind: "prove-doors",
      path: "fixtures/locate/report-sample/prove-doors.json",
      label: "prove-doors",
    },
  ],
  findings: [
    {
      path: "src/search.js",
      rank: 1,
      cweIds: ["CWE-89"],
      evidence: ["cassette:replay"],
      source: "prove-doors",
    },
  ],
  disclaimers: ["Localization ≠ exploitability"],
  runpod: false,
  whatWasRun: { keyless: true, historicalGpu: false },
};

function makeDeps(clicks: string[]) {
  const fakeAnchors: Array<{ download: string; href: string }> = [];
  return {
    clicks,
    fakeAnchors,
    deps: {
      createObjectURL: (blob: Blob) => {
        assert.ok(blob instanceof Blob);
        return `blob:report-test-${clicks.length}`;
      },
      revokeObjectURL: () => {},
      createElement: ((tag: string) => {
        assert.equal(tag, "a");
        const fakeAnchor = {
          href: "",
          download: "",
          rel: "",
          parentNode: null as { removeChild: (el: unknown) => void } | null,
          setAttribute(_k: string, _v: string) {},
          click() {
            clicks.push(this.download);
          },
        };
        fakeAnchors.push(fakeAnchor);
        return fakeAnchor as unknown as HTMLAnchorElement;
      }) as Document["createElement"],
      appendChild: (el: HTMLElement) => {
        const a = el as HTMLAnchorElement;
        (a as unknown as { parentNode: unknown }).parentNode = {
          removeChild() {},
        };
      },
      removeChild: () => {},
    },
  };
}

describe("report download helper", () => {
  it("stripReportDownloadEnvelope drops Desk-only fields", () => {
    const stripped = stripReportDownloadEnvelope(SAMPLE_PAYLOAD);
    assert.equal(stripped.ok, undefined);
    assert.equal(stripped.markdown, undefined);
    assert.equal(stripped.source, undefined);
    assert.equal(stripped.startsRunPod, undefined);
    assert.equal(stripped.schemaVersion, REPORT_SCHEMA);
    assert.equal(stripped.runpod, false);
  });

  it("serializeReportJson matches CLI --out pretty JSON + trailing newline", () => {
    const text = serializeReportJson(SAMPLE_PAYLOAD);
    assert.ok(text.endsWith("\n"));
    const parsed = JSON.parse(text) as {
      schemaVersion: string;
      ok?: boolean;
      markdown?: string;
      runpod: boolean;
    };
    assert.equal(parsed.schemaVersion, REPORT_SCHEMA);
    assert.equal(parsed.ok, undefined);
    assert.equal(parsed.markdown, undefined);
    assert.equal(parsed.runpod, false);
  });

  it("serializeReportMarkdown uses API markdown field", () => {
    const text = serializeReportMarkdown(SAMPLE_PAYLOAD);
    assert.match(text, /Localization only/);
    assert.ok(text.endsWith("\n"));
  });

  it("downloadReportJson uses filename report.json and clicks anchor", () => {
    const { clicks, deps } = makeDeps([]);
    const result = downloadReportJson(SAMPLE_PAYLOAD, { deps });
    assert.equal(result.filename, REPORT_JSON_DOWNLOAD_FILENAME);
    assert.equal(result.filename, "report.json");
    assert.equal(result.schemaHint, REPORT_SCHEMA);
    assert.equal(result.text, serializeReportJson(SAMPLE_PAYLOAD));
    assert.deepEqual(clicks, ["report.json"]);
  });

  it("downloadReportMarkdown uses filename report.md", () => {
    const { clicks, deps } = makeDeps([]);
    const result = downloadReportMarkdown(SAMPLE_PAYLOAD, { deps });
    assert.equal(result.filename, REPORT_MD_DOWNLOAD_FILENAME);
    assert.equal(result.filename, "report.md");
    assert.deepEqual(clicks, ["report.md"]);
  });

  it("downloadReportFiles downloads json + md", () => {
    const { clicks, deps } = makeDeps([]);
    const result = downloadReportFiles(SAMPLE_PAYLOAD, { deps });
    assert.deepEqual(
      result.files.map((f) => f.filename),
      [...REPORT_DOWNLOAD_FILENAMES],
    );
    assert.deepEqual(clicks, ["report.json", "report.md"]);
  });

  it("panel wires Generate report + Download/Copy after report run", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const helper = fs.readFileSync(
      path.join(root, "src/desk/report-download.ts"),
      "utf8",
    );
    assert.match(helper, /REPORT_JSON_DOWNLOAD_FILENAME/);
    assert.match(helper, /REPORT_MD_DOWNLOAD_FILENAME/);
    assert.match(helper, /serializeReportJson/);
    assert.match(helper, /downloadReportJson/);
    assert.match(helper, /downloadReportMarkdown/);
    assert.match(helper, /zeroday\.report\/v1/);
    assert.match(helper, /does not start RunPod/i);
    assert.match(prove, /downloadReportFiles/);
    assert.match(prove, /downloadReportJson/);
    assert.match(prove, /data-testid="prove-doors-report-download-json"/);
    assert.match(prove, /data-testid="prove-doors-report-download-md"/);
    assert.match(prove, /testId="prove-doors-report-copy"/);
    assert.match(prove, /Generate report/);
    assert.match(prove, /Same shape as CLI/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
  });
});
