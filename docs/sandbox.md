# Exploration sandbox

Live/query exploration can run allowlisted inspection commands inside an isolated Docker container.

| Control | Value |
|---------|--------|
| Image | `ubuntu:24.04` (`ZERODAY_SANDBOX_IMAGE`) |
| Network | `none` |
| Command timeout | 10s default |
| Memory / CPUs | `512m` / `1` (env overrides) |
| Mount | host snapshot → `/snapshot:ro` |
| Allowlist | `grep` `find` `cat` `ls` `head` `tail` `wc` … (Antares-like) |
| Lifecycle | create → exec → **destroy** |

Inference stays on the **host** (`vllm serve` → `POST /v1/completions`) because the sandbox cannot reach the network. Fixture locate and the GitHub Action are **container-free**.

```bash
# Unit + allowlist tests always run; Docker integration skips if no daemon
npm test
```
