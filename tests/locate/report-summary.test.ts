/**
 * zeroday report — CISO localization summary from prove-doors / SARIF.
 * Fail-closed · runpod:false · no metrics invented · reuses existing fixtures.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  runReport,
  formatReportMarkdown,
  writeReportArtifacts,
  parseProveDoorsJson,
  ReportError,
  REPORT_SCHEMA,
} from "../../src/locate/report-summary.ts";
import { PROVE_DOORS_SCHEMA } from "../../src/desk/prove-doors.ts";
import { GPU_EVIDENCE_REL } from "../../src/desk/gpu-evidence.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "cli/index.ts");
const FIXTURE_PROVE = path.join(
  root,
  "fixtures/locate/report-sample/prove-doors.json",
);
const FIXTURE_SARIF = path.join(
  root,
  "fixtures/locate/ingest-sample/sample.sarif",
);

function runReportCli(
  args: string[],
  timeoutMs = 60_000,
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", cli, "report", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: timeoutMs,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

describe("report-summary module", () => {
  it("parses fixture prove-doors.json (zeroday-prove-doors/v1)", () => {
    const raw = JSON.parse(fs.readFileSync(FIXTURE_PROVE, "utf8"));
    const prove = parseProveDoorsJson(raw);
    assert.equal(prove.schemaVersion, PROVE_DOORS_SCHEMA);
    assert.equal(prove.ok, true);
    assert.equal(prove.doors.cassette.status, "ok");
  });

  it("fail-closed on wrong prove-doors schema", () => {
    assert.throws(
      () => parseProveDoorsJson({ schemaVersion: "nope", ok: true }),
      (e: unknown) =>
        e instanceof ReportError && e.code === "INPUT_SCHEMA",
    );
  });

  it("builds report from prove-doors fixture with ranked file + disclaimers", () => {
    const report = runReport({
      from: FIXTURE_PROVE,
      cwd: root,
      generatedAt: "2026-09-20T12:00:00.000Z",
    });
    assert.equal(report.schemaVersion, REPORT_SCHEMA);
    assert.equal(report.generated_at, "2026-09-20T12:00:00.000Z");
    assert.equal(report.runpod, false);
    assert.equal(report.whatWasRun.keyless, true);
    assert.ok(report.whatWasRun.doorsLabel?.includes("prove-doors"));
    assert.ok(report.sources.some((s) => s.kind === "prove-doors"));
    assert.ok(report.findings.length >= 1);
    assert.equal(report.findings[0]?.path, "src/search.js");
    assert.equal(report.findings[0]?.rank, 1);
    assert.ok(report.findings[0]?.cweIds?.includes("CWE-89"));
    assert.ok(
      report.disclaimers.some((d) => /Localization ≠ exploitability/i.test(d)),
    );
    assert.ok(report.disclaimers.some((d) => /No PoC/i.test(d)));
    assert.ok(report.disclaimers.some((d) => /runpod: false/i.test(d)));
    // Door D in fixture has no nested result — do not invent GPU footnote.
    assert.equal(report.whatWasRun.historicalGpu, false);
    assert.equal(report.gpuFootnote, undefined);
  });

  it("builds report from sample SARIF with evidence snippets", () => {
    const report = runReport({
      sarif: FIXTURE_SARIF,
      cwd: root,
      generatedAt: "2026-09-20T12:00:00.000Z",
    });
    assert.equal(report.schemaVersion, REPORT_SCHEMA);
    assert.equal(report.runpod, false);
    assert.ok(report.sources.some((s) => s.kind === "sarif"));
    assert.ok(report.findings.length >= 2);
    const paths = report.findings.map((f) => f.path);
    assert.ok(paths.includes("src/search.js"));
    assert.ok(paths.includes("src/render.js"));
    const search = report.findings.find((f) => f.path === "src/search.js");
    assert.ok(search?.evidence.some((e) => /user-provided/i.test(e)));
    assert.ok(search?.cweIds?.some((c) => /CWE-89/i.test(c)));
  });

  it("optional gpu-evidence adds historical footnote only", () => {
    const report = runReport({
      from: FIXTURE_PROVE,
      gpuEvidence: GPU_EVIDENCE_REL,
      cwd: root,
    });
    assert.equal(report.whatWasRun.historicalGpu, true);
    assert.ok(report.gpuFootnote);
    assert.equal(report.gpuFootnote?.historical, true);
    assert.equal(report.gpuFootnote?.startsRunPod, false);
    assert.equal(report.gpuFootnote?.rankedFile, "src/users.js");
    assert.ok(report.gpuFootnote?.podId);
    assert.equal(report.runpod, false);
  });

  it("fail-closed when neither --from nor --sarif", () => {
    assert.throws(
      () => runReport({ cwd: root }),
      (e: unknown) =>
        e instanceof ReportError && e.code === "INPUT_MISSING",
    );
  });

  it("fail-closed on missing prove-doors path", () => {
    assert.throws(
      () =>
        runReport({
          from: "does-not-exist-prove-doors.json",
          cwd: root,
        }),
      (e: unknown) =>
        e instanceof ReportError && e.code === "INPUT_MISSING",
    );
  });

  it("fail-closed on corrupt prove-doors JSON", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-report-bad-"));
    const bad = path.join(tmp, "bad.json");
    fs.writeFileSync(bad, "{not-json", "utf8");
    assert.throws(
      () => runReport({ from: bad, cwd: root }),
      (e: unknown) =>
        e instanceof ReportError && e.code === "INPUT_CORRUPT",
    );
  });

  it("markdown includes non-claims and no exploit framing", () => {
    const report = runReport({ from: FIXTURE_PROVE, cwd: root });
    const md = formatReportMarkdown(report);
    assert.match(md, /Localization only/i);
    assert.match(md, /src\/search\.js/);
    assert.match(md, /Explicit non-claims/i);
    assert.match(md, /runpod/i);
    assert.match(md, /Localization ≠ exploitability/i);
    assert.match(md, /Not proof of exploitability/i);
    assert.match(md, /No AUROC/);
    assert.doesNotMatch(md, /\bproof of exploit\b/i);
    assert.doesNotMatch(md, /\bPoC payload\b/i);
    assert.doesNotMatch(md, /create-pod/i);
  });

  it("writeReportArtifacts writes markdown + json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-report-out-"));
    const report = runReport({ from: FIXTURE_PROVE, cwd: root });
    const mdPath = writeReportArtifacts(
      report,
      path.join(tmp, "report.md"),
      "markdown",
    );
    const jsonPath = writeReportArtifacts(
      report,
      path.join(tmp, "report.json"),
      "json",
    );
    assert.ok(fs.existsSync(mdPath));
    assert.ok(fs.existsSync(jsonPath));
    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
      schemaVersion: string;
      runpod: boolean;
    };
    assert.equal(parsed.schemaVersion, REPORT_SCHEMA);
    assert.equal(parsed.runpod, false);
  });
});

describe("CLI report", () => {
  it("package.json exposes report → cli report", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["report"], "missing npm run report");
    assert.match(pkg.scripts["report"], /report/);
  });

  it("VS Code / Codespaces task wires report --out out/report.md + out/report.json", () => {
    const tasksPath = path.join(root, ".vscode/tasks.json");
    assert.ok(fs.existsSync(tasksPath), "missing .vscode/tasks.json");
    const tasks = JSON.parse(fs.readFileSync(tasksPath, "utf8")) as {
      tasks: Array<{ label?: string; command?: string }>;
    };
    const reportTask = tasks.tasks.find((t) =>
      /^ZERODAY:\s*report$/i.test(String(t.label ?? "").trim()),
    );
    assert.ok(reportTask, 'missing VS Code task "ZERODAY: report"');
    assert.equal(reportTask.label, "ZERODAY: report");
    assert.match(String(reportTask.command), /npm run report/);
    assert.match(
      String(reportTask.command),
      /fixtures\/locate\/report-sample\/prove-doors\.json/,
    );
    assert.match(String(reportTask.command), /--out out\/report\.md/);
    assert.match(String(reportTask.command), /--out out\/report\.json/);
    assert.doesNotMatch(
      String(reportTask.command),
      /create-pod|runpod|--endpoint|--live/i,
    );
  });

  it("markdown from --from prove-doors fixture", () => {
    const r = runReportCli(["--from", FIXTURE_PROVE]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /ZERODAY localization summary/);
    assert.match(r.stdout, /src\/search\.js/);
    assert.match(r.stdout, /Localization ≠ exploitability|Localization only/i);
    assert.doesNotMatch(r.stdout, /starts RunPod|create-pod/i);
  });

  it("--json emits zeroday.report/v1", () => {
    const r = runReportCli(["--from", FIXTURE_PROVE, "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const json = JSON.parse(r.stdout) as {
      schemaVersion: string;
      runpod: boolean;
      findings: unknown[];
      disclaimers: string[];
    };
    assert.equal(json.schemaVersion, REPORT_SCHEMA);
    assert.equal(json.runpod, false);
    assert.ok(Array.isArray(json.findings));
    assert.ok(json.findings.length >= 1);
    assert.ok(json.disclaimers.some((d) => /needs_human/i.test(d)));
  });

  it("--sarif sample fixture exits 0", () => {
    const r = runReportCli(["--sarif", FIXTURE_SARIF, "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const json = JSON.parse(r.stdout) as {
      findings: Array<{ path: string }>;
      runpod: boolean;
    };
    assert.equal(json.runpod, false);
    assert.ok(json.findings.some((f) => f.path === "src/search.js"));
  });

  it("--out writes markdown file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-report-cli-"));
    const out = path.join(tmp, "out", "report.md");
    const r = runReportCli(["--from", FIXTURE_PROVE, "--out", out]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(out));
    const body = fs.readFileSync(out, "utf8");
    assert.match(body, /src\/search\.js/);
  });

  it("fail-closed missing input exits non-zero", () => {
    const r = runReportCli([]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /report failed/);
  });

  it("fail-closed bad schema exits non-zero with --json", () => {
    const tmp = fs.mkdtempSync(path.join(root, "out", "zd-report-schema-"));
    const bad = path.join(tmp, "bad-prove.json");
    try {
      fs.writeFileSync(
        bad,
        JSON.stringify({ schemaVersion: "wrong", ok: true }) + "\n",
        "utf8",
      );
      const r = runReportCli(["--from", bad, "--json"]);
      assert.notEqual(r.status, 0);
      const json = JSON.parse(r.stdout) as {
        ok: boolean;
        runpod: boolean;
        code?: string;
      };
      assert.equal(json.ok, false);
      assert.equal(json.runpod, false);
      assert.equal(json.code, "INPUT_SCHEMA");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
