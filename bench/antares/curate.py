#!/usr/bin/env python3
"""
Curate the Antares localization benchmark from public advisory data.

Input: OSV bulk exports (https://osv-vulnerabilities.storage.googleapis.com/<eco>/all.zip)
Output: bench/antares/cases.json

A case is a GitHub-reviewed advisory with exactly one CWE and exactly one fix
commit. The vulnerable snapshot is the fix commit's parent; ground truth is the
non-test source files the fix changed. Only the commit pair is fetched
(`git fetch --depth=2 --filter=blob:none`), never the advisory's patch text.

Usage: python3 bench/antares/curate.py <dir-with-osv-zips> [--per-cwe 3]
"""

import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

RULES_CWES = ["CWE-89", "CWE-79", "CWE-22", "CWE-78", "CWE-94", "CWE-502", "CWE-918", "CWE-601"]
# Weakness classes the rules engine has no model of — where a localization model has to earn its place.
MODEL_ONLY_CWES = ["CWE-862", "CWE-287", "CWE-1333", "CWE-1321"]
SOURCE_EXT = {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".py", ".java", ".go"}
TEST_RE = re.compile(r"(^|/)(tests?|__tests__|spec|specs|testing|testdata|fixtures?|examples?|docs?|benchmarks?)/|(_test\.go|\.test\.[jt]sx?|\.spec\.[jt]sx?|Test\.java|(^|/)test_[^/]+\.py|_test\.py)$")
COMMIT_RE = re.compile(r"^https://github\.com/([^/]+)/([^/]+)/commit/([0-9a-f]{40})$")


def git(args, cwd, timeout=120):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=timeout)


def inspect(owner, repo, sha):
    """Changed source files of the fix, and file count of the vulnerable tree."""
    with tempfile.TemporaryDirectory() as d:
        git(["init", "-q"], d)
        git(["remote", "add", "origin", f"https://github.com/{owner}/{repo}.git"], d)
        f = git(["fetch", "-q", "--depth=2", "--filter=blob:none", "origin", sha], d, timeout=180)
        if f.returncode != 0:
            return None
        parents = git(["rev-list", "--parents", "-n", "1", sha], d).stdout.split()
        if len(parents) != 2:  # merge commits and roots make ambiguous ground truth
            return None
        parent = parents[1]
        changed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", parent, sha], d).stdout.split("\n")
        changed = [c for c in changed if c]
        files = git(["ls-tree", "-r", "--name-only", parent], d).stdout.split("\n")
        return {"parent": parent, "changed": changed, "treeFiles": len([x for x in files if x])}


def main():
    src = Path(sys.argv[1])
    per_cwe = int(sys.argv[sys.argv.index("--per-cwe") + 1]) if "--per-cwe" in sys.argv else 3
    wanted = RULES_CWES + MODEL_ONLY_CWES
    pool = {c: [] for c in wanted}
    for eco in ["npm", "PyPI", "Go", "Maven"]:
        with zipfile.ZipFile(src / f"{eco}.zip") as z:
            for n in z.namelist():
                if not n.startswith("GHSA"):
                    continue
                r = json.loads(z.read(n))
                cwes = r.get("database_specific", {}).get("cwe_ids", [])
                if r.get("withdrawn") or len(cwes) != 1 or cwes[0] not in pool:
                    continue
                fixes = [m for m in (COMMIT_RE.match(x["url"]) for x in r.get("references", [])) if m]
                if len(fixes) != 1:
                    continue
                owner, repo, sha = fixes[0].groups()
                pool[cwes[0]].append({
                    "id": r["id"],
                    "cve": next((a for a in r.get("aliases", []) if a.startswith("CVE-")), None),
                    "cwe": cwes[0],
                    "ecosystem": eco,
                    "package": r["affected"][0]["package"]["name"],
                    "published": r.get("published", "")[:10],
                    "summary": r.get("summary", "")[:160],
                    "repo": f"https://github.com/{owner}/{repo}",
                    "fixCommit": sha,
                })

    cases, seen_repos, log = [], set(), []
    for cwe in wanted:
        got = 0
        for c in sorted(pool[cwe], key=lambda x: x["published"], reverse=True):
            if got >= per_cwe:
                break
            if c["repo"] in seen_repos:
                continue
            owner, repo = c["repo"].split("/")[-2:]
            info = inspect(owner, repo, c["fixCommit"])
            if not info:
                log.append(f"skip {c['id']}: fetch/merge")
                continue
            src_files = [p for p in info["changed"] if Path(p).suffix in SOURCE_EXT and not TEST_RE.search(p)]
            if not 1 <= len(src_files) <= 3 or not 30 <= info["treeFiles"] <= 3000:
                log.append(f"skip {c['id']}: {len(src_files)} src files, {info['treeFiles']} tree files")
                continue
            cases.append({**c, "vulnerableCommit": info["parent"], "groundTruth": src_files,
                          "changedFiles": len(info["changed"]), "treeFiles": info["treeFiles"],
                          "rulesCoverCwe": cwe in RULES_CWES})
            seen_repos.add(c["repo"])
            got += 1
            print(f"{cwe}: {c['id']} {c['repo']} → {src_files}", flush=True)
        if got < per_cwe:
            print(f"{cwe}: only {got} case(s)", flush=True)

    out = Path(__file__).with_name("cases.json")
    out.write_text(json.dumps({
        "schema": "zeroday.antares-bench.cases/v1",
        "source": "OSV bulk export (GitHub-reviewed advisories); ground truth = non-test source files changed by the single fix commit",
        "selection": {"perCwe": per_cwe, "newestFirst": True, "srcFilesChanged": "1-3", "treeFiles": "30-3000", "oneCasePerRepo": True},
        "cases": cases,
    }, indent=1) + "\n")
    print(f"{len(cases)} cases → {out}")


if __name__ == "__main__":
    main()
