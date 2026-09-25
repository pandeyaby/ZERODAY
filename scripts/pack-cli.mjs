#!/usr/bin/env node
/**
 * Stage the npm package for the ZERODAY CLI (`npx zeroday-cli`).
 *
 * The repo root package.json is the private Next.js Desk app. The published
 * package is CLI-only: TypeScript sources run through tsx, with commander +
 * tsx as the only dependencies (no Next / React / native SQLite).
 *
 * Usage:
 *   node scripts/pack-cli.mjs            # stage → dist/npm/ and `npm pack` a tarball
 *   node scripts/pack-cli.mjs --no-pack  # stage only
 *   (publish: cd dist/npm && npm publish --provenance --access public)
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const NPM_PACKAGE_NAME = "zeroday-cli";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "npm");

/** Paths copied into the package (relative to repo root). */
const INCLUDE = [
  "bin",
  "cli",
  "src",
  "data",
  "fixtures",
  "docs",
  "examples",
  "scripts",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "SCOPE_AND_AUTHORIZATION.md",
  "SUPPORT.md",
  "CHANGELOG.md",
];

/** Web-only or bulky paths the CLI never reads. */
const EXCLUDE = new Set([
  "src/app",
  "src/components",
  "docs/images",
  "data/st3gg",
]);

const EXCLUDE_FILE = /\.(db|db-shm|db-wal)$|^zeroday-store\.json$|^\.DS_Store$/;

function copy(rel) {
  if (EXCLUDE.has(rel)) return;
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(src)) copy(path.join(rel, name));
    return;
  }
  if (EXCLUDE_FILE.test(path.basename(rel))) return;
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, stat.mode);
}

export function buildManifest(rootPkg) {
  const deps = { ...rootPkg.dependencies, ...rootPkg.devDependencies };
  return {
    name: NPM_PACKAGE_NAME,
    version: rootPkg.version,
    description:
      "ZERODAY CLI — rank which files in your repo matter for a CWE / CVE / GHSA and emit SARIF + hashed evidence for human review. Keyless and offline by default. Not a Cisco product.",
    license: rootPkg.license,
    repository: { type: "git", url: "git+https://github.com/pandeyaby/ZERODAY.git" },
    homepage: "https://github.com/pandeyaby/ZERODAY#readme",
    bugs: { url: "https://github.com/pandeyaby/ZERODAY/issues" },
    keywords: ["security", "sarif", "cwe", "cve", "ghsa", "vulnerability", "localization", "appsec"],
    bin: { zeroday: "bin/zeroday.mjs" },
    engines: rootPkg.engines,
    os: rootPkg.os,
    dependencies: {
      commander: deps.commander,
      tsx: deps.tsx,
    },
  };
}

function main() {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const rel of INCLUDE) copy(rel);
  fs.writeFileSync(
    path.join(out, "package.json"),
    `${JSON.stringify(buildManifest(rootPkg), null, 2)}\n`,
  );
  console.log(`Staged ${NPM_PACKAGE_NAME}@${rootPkg.version} → ${path.relative(root, out)}/`);

  if (!process.argv.includes("--no-pack")) {
    const tgz = execFileSync("npm", ["pack", "--pack-destination", path.join(root, "dist")], {
      cwd: out,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .pop();
    console.log(`Tarball: dist/${tgz}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
