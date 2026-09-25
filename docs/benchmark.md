# Rules engine accuracy

How well `zeroday locate --rules` finds the right files, measured on labeled test
suites. Reproduce everything on this page with `npm run bench`.

**Localization, not proof.** A flagged file is a candidate for human review. These
numbers describe how often the candidates are right; they do not make any finding
an exploit.

## What is measured

Each test case is one source file labeled *vulnerable* or *safe* for one CWE. A case
counts as **flagged** when the engine reports at least one finding for that CWE in
the file.

- **Precision** — flagged cases that are really vulnerable.
- **Recall (TPR)** — vulnerable cases that get flagged.
- **False-positive rate (FPR)** — safe cases that get flagged.
- **Score = TPR − FPR** (Youden's J, the OWASP Benchmark metric). Flagging everything
  or nothing scores 0; a perfect tool scores 100.

Results are reported at two operating points, matching how findings are ranked in
`report.md` / SARIF:

| Operating point | What counts | Use it for |
|-----------------|-------------|------------|
| **High confidence** (`--min-score 85`) | Request input traced to a sink | Triage queues, CI gates |
| **All candidates** (default) | Also dynamically built values reaching a sink (e.g. a helper that concatenates its argument into SQL), dangerous APIs (deserialization, XXE-prone parsers) and hard-coded credentials | Audits where recall matters more |

## Suites

| Suite | Languages | Cases (supported CWEs) | Independent? |
|-------|-----------|-----------------------:|--------------|
| [OWASP Benchmark for Java](https://github.com/OWASP-Benchmark/BenchmarkJava) | Java | 1,478 | Yes — third-party, downloaded at bench time (GPL-2.0, not redistributed) |
| [OWASP Benchmark for Python](https://github.com/OWASP-Benchmark/BenchmarkPython) | Python | 462 | Yes — third-party, downloaded at bench time (GPL-3.0, not redistributed) |
| [`bench/corpus`](../bench/corpus) | JS / TS, Go | 54 | **No** — written by the ZERODAY maintainers |

The OWASP suites cover CWE-22, 78, 79 and 89 (Java) plus 94, 502, 601 and 611
(Python). No comparable independent suite exists for JavaScript or Go, so those
numbers come from the maintainer corpus and should be read as a regression check,
not an independent measurement.

## Results (0.8.0)

### High confidence

#### OWASP Benchmark (Java)

Source: `OWASP-Benchmark/BenchmarkJava` @ `20cbf3d` · GPL-2.0 (downloaded, not redistributed)

| CWE | Cases | Precision | Recall (TPR) | False-positive rate | Score (TPR − FPR) |
|-----|------:|----------:|-------------:|--------------------:|------------------:|
| CWE-22 | 268 | 74.3% | 75.9% | 25.9% | **50** |
| CWE-78 | 251 | 77.2% | 77.8% | 23.2% | **54.6** |
| CWE-79 | 455 | 85.5% | 81.3% | 16.3% | **65** |
| CWE-89 | 504 | 79.5% | 81.3% | 24.6% | **56.7** |
| **All** | 1478 | 80% | 79.8% | 22.1% | **57.7** |

#### OWASP Benchmark (Python)

Source: `OWASP-Benchmark/BenchmarkPython` @ `f129148` · GPL-3.0 (downloaded, not redistributed)

| CWE | Cases | Precision | Recall (TPR) | False-positive rate | Score (TPR − FPR) |
|-----|------:|----------:|-------------:|--------------------:|------------------:|
| CWE-22 | 168 | 86% | 56.9% | 5.8% | **51.1** |
| CWE-78 | 20 | 77.8% | 53.8% | 28.6% | **25.2** |
| CWE-79 | 89 | 71% | 71% | 15.5% | **55.5** |
| CWE-89 | 16 | 100% | 60% | 0% | **60** |
| CWE-94 | 53 | 87.5% | 70% | 6.1% | **63.9** |
| CWE-502 | 54 | 86.7% | 72.2% | 5.6% | **66.6** |
| CWE-601 | 34 | 75% | 92.3% | 19% | **73.3** |
| CWE-611 | 28 | 0% | 0% | 0% | **0** |
| **All** | 462 | 81.2% | 62.4% | 8.7% | **53.7** |

#### ZERODAY corpus (maintainer-written)

Source: `bench/corpus` @ `in-repo` · Apache-2.0 (this repo)

| CWE | Cases | Precision | Recall (TPR) | False-positive rate | Score (TPR − FPR) |
|-----|------:|----------:|-------------:|--------------------:|------------------:|
| CWE-22 | 6 | 100% | 100% | 0% | **100** |
| CWE-78 | 6 | 100% | 100% | 0% | **100** |
| CWE-79 | 8 | 100% | 75% | 0% | **75** |
| CWE-89 | 10 | 100% | 80% | 0% | **80** |
| CWE-94 | 3 | 100% | 50% | 0% | **50** |
| CWE-502 | 2 | 100% | 100% | 0% | **100** |
| CWE-601 | 6 | 100% | 100% | 0% | **100** |
| CWE-611 | 2 | 100% | 100% | 0% | **100** |
| CWE-798 | 6 | 100% | 66.7% | 0% | **66.7** |
| CWE-918 | 5 | 100% | 100% | 0% | **100** |
| **All** | 54 | 100% | 85.7% | 0% | **85.7** |


### All candidates

#### OWASP Benchmark (Java)

Source: `OWASP-Benchmark/BenchmarkJava` @ `20cbf3d` · GPL-2.0 (downloaded, not redistributed)

| CWE | Cases | Precision | Recall (TPR) | False-positive rate | Score (TPR − FPR) |
|-----|------:|----------:|-------------:|--------------------:|------------------:|
| CWE-22 | 268 | 74.3% | 75.9% | 25.9% | **50** |
| CWE-78 | 251 | 53.9% | 93.7% | 80.8% | **12.9** |
| CWE-79 | 455 | 85.5% | 81.3% | 16.3% | **65** |
| CWE-89 | 504 | 68.4% | 98.5% | 53.4% | **45.1** |
| **All** | 1478 | 70% | 88.4% | 41.9% | **46.5** |

#### OWASP Benchmark (Python)

Source: `OWASP-Benchmark/BenchmarkPython` @ `f129148` · GPL-3.0 (downloaded, not redistributed)

| CWE | Cases | Precision | Recall (TPR) | False-positive rate | Score (TPR − FPR) |
|-----|------:|----------:|-------------:|--------------------:|------------------:|
| CWE-22 | 168 | 86% | 56.9% | 5.8% | **51.1** |
| CWE-78 | 20 | 50% | 53.8% | 100% | **-46.2** |
| CWE-79 | 89 | 71% | 71% | 15.5% | **55.5** |
| CWE-89 | 16 | 100% | 100% | 0% | **100** |
| CWE-94 | 53 | 80% | 100% | 15.2% | **84.8** |
| CWE-502 | 54 | 60% | 100% | 33.3% | **66.7** |
| CWE-601 | 34 | 75% | 92.3% | 19% | **73.3** |
| CWE-611 | 28 | 53.3% | 100% | 35% | **65** |
| **All** | 462 | 72.1% | 74.6% | 17.3% | **57.3** |

#### ZERODAY corpus (maintainer-written)

Source: `bench/corpus` @ `in-repo` · Apache-2.0 (this repo)

| CWE | Cases | Precision | Recall (TPR) | False-positive rate | Score (TPR − FPR) |
|-----|------:|----------:|-------------:|--------------------:|------------------:|
| CWE-22 | 6 | 100% | 100% | 0% | **100** |
| CWE-78 | 6 | 100% | 100% | 0% | **100** |
| CWE-79 | 8 | 100% | 100% | 0% | **100** |
| CWE-89 | 10 | 100% | 100% | 0% | **100** |
| CWE-94 | 3 | 100% | 100% | 0% | **100** |
| CWE-502 | 2 | 100% | 100% | 0% | **100** |
| CWE-601 | 6 | 100% | 100% | 0% | **100** |
| CWE-611 | 2 | 100% | 100% | 0% | **100** |
| CWE-798 | 6 | 100% | 100% | 0% | **100** |
| CWE-918 | 5 | 100% | 100% | 0% | **100** |
| **All** | 54 | 100% | 100% | 0% | **100** |


## How we got here — read before comparing

- The engine was **developed while looking at these suites.** Every change was a
  general analysis capability (branch merging with constant folding, per-CWE
  sanitizers, container and loop tracking, same-file helper summaries, validation
  guards with early exit, Java declared types), not a rule matching specific test
  files, and the same changes were checked against real projects (below). Still,
  numbers from a suite you tuned against are optimistic; expect lower accuracy on
  unfamiliar code.
- First measurement of the engine, before any of that work (all candidates):
  **Java 5.5**, **Python 20.1**.
- The maintainer corpus scored **92.3** (all candidates) on its first run, before two
  fixes it exposed: numeric formatting (`strconv.Itoa`) is safe, and a URL whose
  scheme and host are fixed literals is not SSRF.
- OWASP Benchmark cases are deliberately adversarial for pattern tools (dead branches,
  collection lookups by constant key, reflection). Scores on ordinary application code
  are not directly comparable.

## Real-world check

All 10 CWEs, run over shallow clones (high-confidence findings, files per CWE):

| Project | Code | Time | High-confidence files | Notes |
|---------|------|------|-----------------------|-------|
| OWASP Juice Shop (intentionally vulnerable) | 65k lines TS/JS | 2.3 s | CWE-89: 11 · CWE-22: 8 · CWE-79: 2 · CWE-918: 1 · CWE-601: 1 · CWE-94: 1 · CWE-798: 1 | Finds 6 of 8 well-known challenge routes (login / search SQLi, file-server traversal, redirect, SSRF, hard-coded key). Misses the sandboxed-`vm` and XML-upload flaws, which pass through helpers in other files. |
| Express (repo incl. examples) | 22k lines JS | 0.7 s | CWE-79: 15 · CWE-601: 3 · CWE-22: 1 | Example apps send request parameters in HTML responses — real reflections, in demo code. |
| Flask | 18k lines Python | 0.5 s | none | |
| Gin | 25k lines Go | 0.9 s | CWE-601: 1 | Framework trailing-slash redirect built from the request path — benign; a known false positive. |
| Spring PetClinic | 4k lines Java | 0.1 s | none | |

## Limitations

- **Intraprocedural plus same-file helpers.** Input that flows through a function in
  another file is not followed (the two Juice Shop misses above).
- **Framework knowledge is pattern-based**: request sources and sinks are listed in
  [`src/locate/engine/specs.ts`](../src/locate/engine/specs.ts). Unlisted frameworks and
  wrappers are missed.
- **XXE (CWE-611)** is a configuration finding (a parser created without disabling
  external entities), so it only appears in *all candidates*.
- **Hard-coded credentials (CWE-798)** use names and well-known key formats; they score
  below the high-confidence threshold unless the literal matches a known key format.
- Other languages (Ruby, PHP, C#) still use the older line heuristics for CWE-89 / 79 / 22.

## Reproduce

```bash
npm run bench                              # all suites (downloads OWASP suites into .cache/)
npm run bench -- --min-score 85            # high-confidence operating point
npm run bench -- --suite corpus --misses   # one suite, list every miss
npm run bench -- --json out.json --markdown out.md
```

Raw results for this page: [`results-high-confidence.json`](./benchmark/results-high-confidence.json),
[`results-all-candidates.json`](./benchmark/results-all-candidates.json).
