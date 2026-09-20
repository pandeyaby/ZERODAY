/**
 * Client-side doctor.json download helper — serialize + download wiring.
 * Matches CLI `doctor --out out/doctor.json` / CI artifact shape.
 * Historical / local only — does not start RunPod.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadDoctorJson,
  DOCTOR_DOWNLOAD_FILENAME,
  DOCTOR_DOWNLOAD_SCHEMA,
  serializeDoctorJson,
} from "../../src/desk/doctor-download.ts";
import { DOCTOR_SCHEMA } from "../../src/doctor/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SAMPLE_PAYLOAD = {
  schemaVersion: DOCTOR_DOWNLOAD_SCHEMA,
  ok: true,
  checks: [
    { id: "node_runtime", ok: true, detail: "Node v22 usable (>=20)" },
    { id: "no_live_gpu", ok: true, detail: "runpod=false" },
  ],
  runpod: false,
  startsRunPod: false,
  networkRequired: false,
};

describe("doctor download helper", () => {
  it("serializeDoctorJson matches CLI --out pretty JSON + trailing newline", () => {
    const text = serializeDoctorJson(SAMPLE_PAYLOAD);
    assert.equal(text, `${JSON.stringify(SAMPLE_PAYLOAD, null, 2)}\n`);
    assert.ok(text.endsWith("\n"));
    const parsed = JSON.parse(text) as typeof SAMPLE_PAYLOAD;
    assert.equal(parsed.schemaVersion, DOCTOR_SCHEMA);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.startsRunPod, false);
    assert.equal(parsed.runpod, false);
  });

  it("downloadDoctorJson uses filename doctor.json and clicks anchor", () => {
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

    const result = downloadDoctorJson(SAMPLE_PAYLOAD, {
      deps: {
        createObjectURL: (blob) => {
          assert.ok(blob instanceof Blob);
          assert.match(blob.type, /application\/json/);
          return "blob:doctor-test";
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

    assert.equal(result.filename, DOCTOR_DOWNLOAD_FILENAME);
    assert.equal(result.filename, "doctor.json");
    assert.equal(result.schemaHint, DOCTOR_SCHEMA);
    assert.equal(result.text, serializeDoctorJson(SAMPLE_PAYLOAD));
    assert.deepEqual(clicks, ["doctor.json"]);
    assert.equal(fakeAnchor.download, "doctor.json");
    assert.equal(fakeAnchor.href, "blob:doctor-test");
    assert.equal(revoked, "blob:doctor-test");
    assert.equal(created.length, 1);
    assert.equal(created[0]?.download, "doctor.json");
  });

  it("panel wires Download doctor.json + Copy after doctor run", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const helper = fs.readFileSync(
      path.join(root, "src/desk/doctor-download.ts"),
      "utf8",
    );
    assert.match(helper, /DOCTOR_DOWNLOAD_FILENAME/);
    assert.match(helper, /serializeDoctorJson/);
    assert.match(helper, /downloadDoctorJson/);
    assert.match(helper, /zeroday\.doctor\/v1/);
    assert.match(helper, /does not start RunPod/i);
    assert.match(prove, /downloadDoctorJson/);
    assert.match(prove, /DOCTOR_DOWNLOAD_FILENAME/);
    assert.match(prove, /data-testid="prove-doors-doctor-download"/);
    assert.match(prove, /testId="prove-doors-doctor-copy"/);
    assert.match(prove, /Download \{DOCTOR_DOWNLOAD_FILENAME\}/);
    assert.match(prove, /serializeDoctorJson\(doctorResult\)/);
    assert.match(prove, /Same shape as CLI/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
  });
});
