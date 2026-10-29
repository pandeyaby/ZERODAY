/**
 * Rules coverage honesty: PHP / Ruby / C# get line patterns for CWE-89 / 79 / 22,
 * and files the CWE's rules cannot read are reported as not checked, never as clean.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { locate } from "../../src/locate/index.ts";
import { scanRepo } from "../../src/locate/scan.ts";
import { verifyRunDir } from "../../src/evidence/vault.ts";

const repo = (files: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cov-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
};
const out = () => fs.mkdtempSync(path.join(os.tmpdir(), "zd-cov-out-"));

// The classic DVWA-style "low" pages, reduced to the lines that matter.
const PHP = repo({
  "sqli/low.php": `<?php\n$id = $_REQUEST['id'];\n$query = "SELECT first_name, last_name FROM users WHERE user_id = '$id';";\n$result = mysqli_query($db, $query);\n`,
  "sqli/concat.php": `<?php\n$q = "SELECT * FROM t WHERE name = '" . $_GET['name'] . "'";\n`,
  "xss/low.php": `<?php\n$html .= '<pre>Hello ' . $_GET['name'] . '</pre>';\necho "Hi " . $_POST['who'];\n`,
  "fi/low.php": `<?php\n$file = $_GET['page'];\ninclude($file);\n`,
  "safe.php": `<?php\n$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");\necho htmlspecialchars($name);\n`,
});

describe("rules coverage", () => {
  it("finds the classic PHP SQL injection (interpolation and . concatenation)", async () => {
    const { result } = await locate({ repo: PHP, advisory: "CWE-89", rules: true, offline: true, outputDir: out() });
    const files = result.rankedFiles.map((f) => f.filePath);
    assert.ok(files.includes("sqli/low.php"), files.join());
    assert.ok(files.includes("sqli/concat.php"), files.join());
    assert.ok(!files.includes("safe.php"), "prepared statement is not flagged");
  });

  it("finds PHP reflected XSS and file inclusion", async () => {
    const xss = await locate({ repo: PHP, advisory: "CWE-79", rules: true, offline: true, outputDir: out() });
    assert.deepEqual(xss.result.rankedFiles.map((f) => f.filePath), ["xss/low.php"]);
    const fi = await locate({ repo: PHP, advisory: "CWE-22", rules: true, offline: true, outputDir: out() });
    assert.deepEqual(fi.result.rankedFiles.map((f) => f.filePath), ["fi/low.php"]);
  });

  it("finds Ruby and C# interpolated SQL", async () => {
    const dir = repo({
      "app.rb": `User.find_by_sql("SELECT * FROM users WHERE id = #{params[:id]}")\n`,
      "Repo.cs": `var sql = $"SELECT * FROM users WHERE id = {id}";\n`,
    });
    const { result } = await locate({ repo: dir, advisory: "CWE-89", rules: true, offline: true, outputDir: out() });
    assert.deepEqual(result.rankedFiles.map((f) => f.filePath).sort(), ["Repo.cs", "app.rb"]);
  });

  it("reports files the CWE's rules cannot read as NOT checked — never a silent clean", async () => {
    const { result } = await locate({ repo: PHP, advisory: "CWE-78", rules: true, offline: true, outputDir: out() });
    assert.equal(result.rankedFiles.length, 0);
    assert.deepEqual(result.summary.notScannedFiles, { count: 5, languages: { PHP: 5 } });
    assert.ok(result.warnings.some((w) => /^PARTIAL: 5 PHP file\(s\) were NOT checked for CWE-78/.test(w)));
  });

  it("does not warn when every file is in an engine language", async () => {
    const dir = repo({ "a.js": `const q = "SELECT * FROM t WHERE id = " + req.query.id;\ndb.query(q);\n` });
    const { result } = await locate({ repo: dir, advisory: "CWE-78", rules: true, offline: true, outputDir: out() });
    assert.equal(result.summary.notScannedFiles, undefined);
  });

  it("writes needs_human: true at the top of report.json", async () => {
    const a = await locate({ repo: PHP, advisory: "CWE-89", rules: true, offline: true, outputDir: out() });
    assert.equal(JSON.parse(fs.readFileSync(a.jsonPath, "utf8")).needs_human, true);
  });
});

describe("verify a folder of runs", () => {
  it("verifies every run under a parent folder (as `npm run mvp` writes)", async () => {
    const parent = out();
    await locate({ repo: PHP, advisory: "CWE-89", rules: true, offline: true, outputDir: path.join(parent, "a") });
    await locate({ repo: PHP, advisory: "CWE-79", rules: true, offline: true, outputDir: path.join(parent, "b") });
    const ok = verifyRunDir(parent);
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.runs?.map((r) => path.basename(r)), ["a", "b"]);
    fs.appendFileSync(path.join(parent, "b", "report.json"), " ");
    assert.equal(verifyRunDir(parent).ok, false, "a tampered run fails the whole folder");
    assert.equal(verifyRunDir(out()).ok, false, "an empty folder still fails");
  });

  it("lists each artifact once and fails when manifest.json is edited", async () => {
    const dir = out();
    await locate({ repo: PHP, advisory: "CWE-89", rules: true, offline: true, outputDir: dir });
    const mp = path.join(dir, "evidence", "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(mp, "utf8")) as { artifacts: Array<{ relativePath: string }> };
    const paths = manifest.artifacts.map((a) => a.relativePath);
    assert.equal(new Set(paths).size, paths.length, `duplicates in ${paths.join(", ")}`);
    assert.equal(verifyRunDir(dir).ok, true);
    // Drop an artifact from the manifest: every remaining hash still matches.
    manifest.artifacts = manifest.artifacts.filter((a) => a.relativePath !== "comment.md");
    fs.writeFileSync(mp, JSON.stringify(manifest, null, 2));
    const res = verifyRunDir(dir);
    assert.equal(res.ok, false);
    assert.ok(res.failures.some((f) => /manifest\.sha256/.test(f.reason)));
  });
});

describe("scan with a named endpoint", () => {
  it("fails instead of silently falling back to rules only", async () => {
    await assert.rejects(
      scanRepo({ repo: PHP, outputDir: out(), antares: "auto", endpoint: "http://203.0.113.5:8000/v1" }),
    );
  });
});
