---
name: shipping
description: >-
  Use this when planning, implementing, reviewing, or merging ZeroDay work —
  especially multi-step agent tasks, repeated mistakes, or high-volume PR
  shipping. Enforces the Lauren/poteto-style factory: trust first, then volume.
---

# Shipping skill (ZeroDay)

Read and follow `/SHIPPING.md` at the repo root before coding or opening a PR.

Summary:
- GRAX/outer loop picks small verifiable work and demands evidence.
- Inner loop implements, verifies, opens a tight PR.
- For nontrivial ZeroDay implementation, prefer `/poteto-mode` when pstack is installed (see SHIPPING.md Inner loop: pstack).
- On repeated mistakes, harden the tree (test/lint/skill/architecture) — do not only re-prompt.
- No invented accuracy claims. Abhinav yes required to merge.
