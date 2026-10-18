# Linux kernel localization benchmark

A small, reproducible set of already-fixed Linux kernel CVEs for measuring
**localization**: given the vulnerable tree and a public one-line description,
does ZERODAY rank the file, and the function, that the fix later changed?

Defensive only. Every entry is a published CVE with a merged fix. The benchmark
holds no exploit, PoC, or trigger detail, and the fix diff is never given to a model.

**No numbers are claimed here until a measured run.** CI runs only the keyless
rules baseline (below). Antares results get published only after a real GPU run.

## What is in it

| File | What it is |
|---|---|
| [`manifest.json`](manifest.json) | One entry per CVE: CVE id, CWE (and where it came from), public one-line description, fix commit and its date, `Fixes:` commit, parent commit, fixed file, fixed function(s), scope directory |
| [`score.ts`](score.ts) | Scorer: hit@1 / hit@3 / hit@5 on file and on function, from a ZERODAY `report.json` or SARIF |
| [`../../scripts/bench-kernel.ts`](../../scripts/bench-kernel.ts) | `fetch` · `run` · `score` |
| [`../../scripts/bench-kernel-curate.ts`](../../scripts/bench-kernel-curate.ts) | Rebuilds the manifest from public data |

**Task, per entry.** The input is the parent of the fix commit (the pre-fix tree),
limited to the files directly in the entry's `scope` (the fixed file's directory),
plus the CWE and the one-line description. The ground truth is the fixed file and
the function(s) the fix changed.

**Scoring.** File hit@k: the fixed file is in the top k ranked files. Function hit@k:
a fixed `(file, function)` pair is among the top k distinct ranked functions. The
functions come from report evidence (`evidence[].function`, SARIF `logicalLocations`)
or, when only a line is given, the C function enclosing it in the pre-fix file. An
entry with no report counts as a miss.

## How the entries were chosen

[`bench-kernel-curate.ts`](../../scripts/bench-kernel-curate.ts) walks the kernel CNA's
published 2025 and 2026 CVEs ([security/vulns.git](https://git.kernel.org/pub/scm/linux/security/vulns.git))
in id order at a fixed stride (every 23rd) and keeps a CVE only when its mainline fix:

- was authored after 2025-04-10, the Antares-1B training-data cutoff on its model card;
- has exactly one `Fixes:` trailer that resolves in mainline, and a single parent;
- changes exactly one `.c` file (outside `tools/`, `samples/`, `scripts/`, `Documentation/`, `usr/`);
- puts every changed line inside one or two functions of the pre-fix file;
- has a numeric CWE (CVE record ADP container, else NVD);
- is in a directory no earlier entry used.

The parameters and rejection counts are saved in `manifest.json` under `selection`
(24 kept of 131 examined). Re-running the script gives the same list as long as the
public data has not changed. NVD can add or change CWEs later.

## Reproduce

No GPU is needed for the first three steps.

```bash
npm ci
npm run bench:kernel -- fetch              # ~1–2k files from git.kernel.org, blob-verified; no kernel clone
npm run bench:kernel -- run --arms rules   # keyless rules baseline
npm run bench:kernel -- score --arm rules  # prints the table, writes zeroday-reports/bench-kernel/rules/summary.json
```

`fetch` takes the file list from the GitHub mirror's tree API (same commit ids;
`GITHUB_TOKEN` is used when set) and each file from git.kernel.org, checking it
against its git blob id. Files are cached under `~/.cache/zeroday/bench-kernel/`.
Use `--cves CVE-a,CVE-b` to run a subset.

### Rules baseline

None of the CWEs in this set (use-after-free, NULL dereference, leaks, races…) has a
ZERODAY rules pack, so the rules mode reports **NOT SCANNED** for every entry and ranks
nothing. CI runs it anyway: it checks that fetch, rules mode on C trees, and the
scorer work end to end. Its zeros mean "no rules for this CWE", not "clean".

### Antares (GPU, operator only)

Needs `cisco-antares-cli` on `PATH` and a vLLM OpenAI-compatible server for
`fdtn-ai/antares-1b` (see [docs/runpod-antares.md](../../docs/runpod-antares.md)).

```bash
export ANTARES_ENDPOINT=http://<host>:8000/v1   # vLLM OpenAI-compatible base URL
export ZERODAY_REMOTE_INFERENCE_ACK=1           # only when the endpoint is not loopback
npm run bench:kernel -- fetch
npm run bench:kernel -- run --arms antares --model fdtn-ai/antares-1b
npm run bench:kernel -- score --arm antares
```

Each entry calls `locate` with `--cwe` and `--description` (the one-liner), the same as
`zeroday locate --live --cwe <CWE> --description "<one-liner>" --repo <tree>`.

## Caveats

- The one-line description is the fix commit's subject, and it often names the
  subsystem or the function. Description-driven localization is easier than CWE-only.
- Scoping to the fixed file's directory narrows the search. Treat results as
  "within the right subsystem", not "across the whole kernel".
- The C function extractor is heuristic (comments, literals and `#else` branches
  blanked, braces matched). It handles kernel style, but it is not a C parser.
