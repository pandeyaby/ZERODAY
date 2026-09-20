/**
 * Client-side evidence-pack download helper — serialize + multi-file wiring.
 * Matches CLI `evidence-pack --out out/evidence/` file names.
 * Historical only — does not start RunPod.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadEvidencePackFile,
  downloadEvidencePackFiles,
  EVIDENCE_PACK_DOWNLOAD_FILENAMES,
  EVIDENCE_PACK_DOWNLOAD_SCHEMA,
  EVIDENCE_PACK_GPU_EVIDENCE_DOWNLOAD_FILENAME,
  EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME,
  EVIDENCE_PACK_PROVE_DOORS_DOWNLOAD_FILENAME,
  EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME,
  EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME,
  resolveEvidencePackFiles,
  serializeEvidencePackJson,
  serializeEvidencePackMarkdown,
} from "../../src/desk/evidence-pack-download.ts";
import { EVIDENCE_PACK_SCHEMA } from "../../src/locate/evidence-pack.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SAMPLE_REPORT_MD =
  "# ZERODAY localization summary\n\n> **Localization only.** Not proof of exploitability.\n";

const SAMPLE_MANIFEST = {
  schemaVersion: EVIDENCE_PACK_DOWNLOAD_SCHEMA,
  created_at: "2026-09-20T00:00:00.000Z",
  pack_version: "1",
  files: [
    { name: "prove-doors.json", sha256: "abc" },
    { name: "gpu-evidence.json", sha256: "def" },
    { name: "report.json", sha256: "ghi" },
    { name: "report.md", sha256: "jkl" },
  ],
  notes: ["does not start RunPod / no GPU spend from evidence-pack"],
  ok: true,
  outDir: "out/evidence",
  historicalGpuEvidenceOnly: true,
  startsRunPod: false,
};

const SAMPLE_PROVE = {
  schemaVersion: "zeroday-prove-doors/v1",
  ok: true,
  doors: { b: { status: "skipped" } },
};

const SAMPLE_GPU = {
  schemaVersion: "zeroday-gpu-evidence/v1",
  ok: true,
  historical: true,
  startsRunPod: false,
};

const SAMPLE_REPORT = {
  schemaVersion: "zeroday.report/v1",
  runpod: false,
  findings: [],
  disclaimers: ["Localization ≠ exploitability"],
};

const SAMPLE_PACK = {
  schemaVersion: EVIDENCE_PACK_DOWNLOAD_SCHEMA,
  ok: true,
  historicalGpuEvidenceOnly: true,
  startsRunPod: false,
  defaultOut: "out/evidence",
  files: {
    [EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME]: SAMPLE_MANIFEST,
    [EVIDENCE_PACK_PROVE_DOORS_DOWNLOAD_FILENAME]: SAMPLE_PROVE,
    [EVIDENCE_PACK_GPU_EVIDENCE_DOWNLOAD_FILENAME]: SAMPLE_GPU,
    [EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME]: SAMPLE_REPORT,
    [EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME]: SAMPLE_REPORT_MD,
  },
  manifest: SAMPLE_MANIFEST,
  proveDoors: SAMPLE_PROVE,
  gpuEvidence: SAMPLE_GPU,
  report: SAMPLE_REPORT,
  reportMarkdown: SAMPLE_REPORT_MD,
};

function fakeDownloadDeps(label: string) {
  const clicks: string[] = [];
  const created: Array<{ download: string; href: string }> = [];
  const blobTypes: string[] = [];
  let revoked: string | null = null;
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
  return {
    clicks,
    created,
    blobTypes,
    getRevoked: () => revoked,
    fakeAnchor,
    deps: {
      createObjectURL: (blob: Blob) => {
        assert.ok(blob instanceof Blob);
        blobTypes.push(blob.type);
        return `blob:evidence-pack-${label}`;
      },
      revokeObjectURL: (url: string) => {
        revoked = url;
      },
      createElement: ((tag: string) => {
        assert.equal(tag, "a");
        return fakeAnchor as unknown as HTMLAnchorElement;
      }) as Document["createElement"],
      appendChild: (el: HTMLElement) => {
        created.push({
          download: (el as HTMLAnchorElement).download,
          href: (el as HTMLAnchorElement).href,
        });
        fakeAnchor.parentNode = {
          removeChild() {},
        };
      },
      removeChild: () => {},
    },
  };
}

describe("evidence-pack download helper", () => {
  it("serializeEvidencePackJson matches CLI --out pretty JSON + trailing newline", () => {
    const text = serializeEvidencePackJson(SAMPLE_MANIFEST);
    assert.equal(text, `${JSON.stringify(SAMPLE_MANIFEST, null, 2)}\n`);
    assert.ok(text.endsWith("\n"));
    const parsed = JSON.parse(text) as typeof SAMPLE_MANIFEST;
    assert.equal(parsed.schemaVersion, EVIDENCE_PACK_SCHEMA);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.startsRunPod, false);
    assert.equal(parsed.historicalGpuEvidenceOnly, true);
  });

  it("resolveEvidencePackFiles reads files map (CLI out/evidence names)", () => {
    const resolved = resolveEvidencePackFiles(SAMPLE_PACK);
    assert.equal(
      resolved[EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME],
      SAMPLE_MANIFEST,
    );
    assert.equal(
      resolved[EVIDENCE_PACK_PROVE_DOORS_DOWNLOAD_FILENAME],
      SAMPLE_PROVE,
    );
    assert.equal(
      resolved[EVIDENCE_PACK_GPU_EVIDENCE_DOWNLOAD_FILENAME],
      SAMPLE_GPU,
    );
    assert.equal(
      resolved[EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME],
      SAMPLE_REPORT,
    );
    assert.equal(
      resolved[EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME],
      SAMPLE_REPORT_MD,
    );
  });

  it("downloadEvidencePackFile uses filename manifest.json and clicks anchor", () => {
    const fake = fakeDownloadDeps("manifest");
    const result = downloadEvidencePackFile(SAMPLE_MANIFEST, {
      filename: EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME,
      deps: fake.deps,
    });
    assert.equal(result.filename, EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME);
    assert.equal(result.filename, "manifest.json");
    assert.equal(result.schemaHint, EVIDENCE_PACK_SCHEMA);
    assert.equal(result.text, serializeEvidencePackJson(SAMPLE_MANIFEST));
    assert.deepEqual(fake.clicks, ["manifest.json"]);
    assert.equal(fake.fakeAnchor.download, "manifest.json");
    assert.equal(fake.getRevoked(), "blob:evidence-pack-manifest");
    assert.match(fake.blobTypes[0] ?? "", /application\/json/);
  });

  it("downloadEvidencePackFiles downloads all CLI filenames incl. report", () => {
    const fake = fakeDownloadDeps("all");
    const result = downloadEvidencePackFiles(SAMPLE_PACK, { deps: fake.deps });
    assert.equal(result.schemaHint, EVIDENCE_PACK_SCHEMA);
    assert.deepEqual(
      result.files.map((f) => f.filename),
      [...EVIDENCE_PACK_DOWNLOAD_FILENAMES],
    );
    assert.deepEqual(fake.clicks, [
      "manifest.json",
      "prove-doors.json",
      "gpu-evidence.json",
      "report.json",
      "report.md",
    ]);
    assert.equal(result.files[0]?.text, serializeEvidencePackJson(SAMPLE_MANIFEST));
    assert.equal(result.files[1]?.text, serializeEvidencePackJson(SAMPLE_PROVE));
    assert.equal(result.files[2]?.text, serializeEvidencePackJson(SAMPLE_GPU));
    assert.equal(result.files[3]?.text, serializeEvidencePackJson(SAMPLE_REPORT));
    assert.equal(result.files[4]?.text, serializeEvidencePackMarkdown(SAMPLE_REPORT_MD));
    assert.match(fake.blobTypes[4] ?? "", /text\/markdown/);
  });

  it("panel wires Download evidence-pack + POST /api/evidence-pack", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const helper = fs.readFileSync(
      path.join(root, "src/desk/evidence-pack-download.ts"),
      "utf8",
    );
    assert.match(helper, /EVIDENCE_PACK_MANIFEST_DOWNLOAD_FILENAME/);
    assert.match(helper, /EVIDENCE_PACK_REPORT_JSON_DOWNLOAD_FILENAME/);
    assert.match(helper, /EVIDENCE_PACK_REPORT_MD_DOWNLOAD_FILENAME/);
    assert.match(helper, /serializeEvidencePackJson/);
    assert.match(helper, /downloadEvidencePackFiles/);
    assert.match(helper, /zeroday\.evidence_pack\/v1/);
    assert.match(helper, /does not start RunPod/i);
    assert.match(prove, /downloadEvidencePackFiles/);
    assert.match(prove, /EVIDENCE_PACK_API_PATH/);
    assert.match(prove, /\/api\/evidence-pack/);
    assert.match(prove, /data-testid="prove-doors-evidence-pack-card"/);
    assert.match(prove, /data-testid="prove-doors-evidence-pack-run"/);
    assert.match(prove, /data-testid="prove-doors-evidence-pack-download"/);
    assert.match(prove, /testId="prove-doors-evidence-pack-copy"/);
    assert.match(prove, /Download evidence-pack/);
    assert.match(prove, /out\/evidence/);
    assert.match(prove, /does not start RunPod/i);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
  });
});
