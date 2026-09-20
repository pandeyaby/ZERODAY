/**
 * Client-side gpu-evidence.json download helper — serialize + download wiring.
 * Matches CLI `gpu-evidence --out gpu-evidence.json` / CI artifact shape.
 * Historical only — does not start RunPod.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadGpuEvidenceJson,
  GPU_EVIDENCE_DOWNLOAD_FILENAME,
  GPU_EVIDENCE_DOWNLOAD_SCHEMA,
  serializeGpuEvidenceJson,
} from "../../src/desk/gpu-evidence-download.ts";
import { GPU_EVIDENCE_SCHEMA } from "../../src/desk/gpu-evidence.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SAMPLE_PAYLOAD = {
  schemaVersion: GPU_EVIDENCE_DOWNLOAD_SCHEMA,
  ok: true,
  source: "docs/reports/a40-live-locate-20260920.json",
  historical: true,
  startsRunPod: false,
  evidence: {
    kind: "zeroday.gpu_live_locate_evidence/v1",
    measured: true,
    pod: { id: "test-pod", gpu: "NVIDIA A40" },
  },
  nonClaims: {
    historicalMeasuredSessionOnly: true,
    notLiveProbe: true,
    doesNotStartRunPod: true,
  },
};

describe("gpu-evidence download helper", () => {
  it("serializeGpuEvidenceJson matches CLI --out pretty JSON + trailing newline", () => {
    const text = serializeGpuEvidenceJson(SAMPLE_PAYLOAD);
    assert.equal(text, `${JSON.stringify(SAMPLE_PAYLOAD, null, 2)}\n`);
    assert.ok(text.endsWith("\n"));
    const parsed = JSON.parse(text) as typeof SAMPLE_PAYLOAD;
    assert.equal(parsed.schemaVersion, GPU_EVIDENCE_SCHEMA);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.historical, true);
    assert.equal(parsed.startsRunPod, false);
  });

  it("downloadGpuEvidenceJson uses filename gpu-evidence.json and clicks anchor", () => {
    const clicks: string[] = [];
    const created: Array<{ download: string; href: string }> = [];
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

    const result = downloadGpuEvidenceJson(SAMPLE_PAYLOAD, {
      deps: {
        createObjectURL: (blob) => {
          assert.ok(blob instanceof Blob);
          assert.match(blob.type, /application\/json/);
          return "blob:gpu-evidence-test";
        },
        revokeObjectURL: (url) => {
          revoked = url;
        },
        createElement: ((tag: string) => {
          assert.equal(tag, "a");
          return fakeAnchor as unknown as HTMLAnchorElement;
        }) as Document["createElement"],
        appendChild: (el) => {
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
    });

    assert.equal(result.filename, GPU_EVIDENCE_DOWNLOAD_FILENAME);
    assert.equal(result.filename, "gpu-evidence.json");
    assert.equal(result.schemaHint, GPU_EVIDENCE_SCHEMA);
    assert.equal(result.text, serializeGpuEvidenceJson(SAMPLE_PAYLOAD));
    assert.deepEqual(clicks, ["gpu-evidence.json"]);
    assert.equal(fakeAnchor.download, "gpu-evidence.json");
    assert.equal(fakeAnchor.href, "blob:gpu-evidence-test");
    assert.equal(revoked, "blob:gpu-evidence-test");
    assert.equal(created.length, 1);
    assert.equal(created[0]?.download, "gpu-evidence.json");
  });

  it("panel wires Download gpu-evidence.json + Copy after evidence load", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const helper = fs.readFileSync(
      path.join(root, "src/desk/gpu-evidence-download.ts"),
      "utf8",
    );
    assert.match(helper, /GPU_EVIDENCE_DOWNLOAD_FILENAME/);
    assert.match(helper, /serializeGpuEvidenceJson/);
    assert.match(helper, /downloadGpuEvidenceJson/);
    assert.match(helper, /zeroday-gpu-evidence\/v1/);
    assert.match(helper, /does not start RunPod/i);
    assert.match(prove, /downloadGpuEvidenceJson/);
    assert.match(prove, /GPU_EVIDENCE_DOWNLOAD_FILENAME/);
    assert.match(prove, /data-testid="prove-doors-a40-evidence-download"/);
    assert.match(prove, /testId="prove-doors-a40-evidence-copy"/);
    assert.match(prove, /Download \{GPU_EVIDENCE_DOWNLOAD_FILENAME\}/);
    assert.match(prove, /serializeGpuEvidenceJson\(evidence\)/);
    assert.match(prove, /Same shape as CLI/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
  });
});
