# Verifying a ZERODAY release

Every release is built by [`.github/workflows/release.yml`](../.github/workflows/release.yml)
on a `vX.Y.Z` tag. Signing is keyless: GitHub Actions proves its identity to
[Sigstore](https://www.sigstore.dev/) with a short-lived OIDC token, so there is
no signing key to leak or rotate. What you can check:

| Artifact | Signed / attested | SBOM |
|----------|-------------------|------|
| `ghcr.io/pandeyaby/zeroday:<version>` | cosign signature + GitHub build-provenance attestation + BuildKit SLSA provenance | SPDX, attached to the image by BuildKit |
| `zeroday-cli-<version>.tgz` (release asset) | GitHub build-provenance attestation, `SHA256SUMS` | `zeroday-cli-<version>.cdx.json` (CycloneDX 1.5, runtime dependencies) |
| `zeroday-cli` on npm (when published) | npm provenance | — |

Applies from 0.11.0. Set the version you use once; the commands below use it:

```bash
V=1.0.0-rc.2        # the version, without the leading v
```

## CLI tarball and SBOM

Download `zeroday-cli-$V.tgz`, `zeroday-cli-$V.cdx.json` and `SHA256SUMS`
from the [release page](https://github.com/pandeyaby/ZERODAY/releases), then:

```bash
sha256sum -c SHA256SUMS
gh attestation verify "zeroday-cli-$V.tgz" --repo pandeyaby/ZERODAY
gh attestation verify "zeroday-cli-$V.cdx.json" --repo pandeyaby/ZERODAY
```

The CycloneDX SBOM lists the runtime dependencies as installed on the Linux x64
release runner. Platform-specific optional packages (native binaries for macOS
or Windows) that npm would pick on your machine are not in it.

`gh attestation verify` confirms the file was built by this repository's
release workflow from the tagged commit, and prints that commit.

## Docker image

```bash
# Sigstore signature, bound to the release workflow run for exactly this tag
cosign verify "ghcr.io/pandeyaby/zeroday:$V" \
  --certificate-identity "https://github.com/pandeyaby/ZERODAY/.github/workflows/release.yml@refs/tags/v$V" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# GitHub build-provenance attestation
gh attestation verify "oci://ghcr.io/pandeyaby/zeroday:$V" --repo pandeyaby/ZERODAY

# SBOM and SLSA provenance that BuildKit attached to the image
docker buildx imagetools inspect "ghcr.io/pandeyaby/zeroday:$V" --format '{{ json .SBOM }}'
docker buildx imagetools inspect "ghcr.io/pandeyaby/zeroday:$V" --format '{{ json .Provenance }}'
```

Pin the image by the digest `cosign verify` prints (`ghcr.io/pandeyaby/zeroday@sha256:…`)
if you need a reproducible deployment; `:latest` and version tags can move.

## Pre-releases (`X.Y.Z-rc.N`)

Release candidates go through the same workflow and are signed and attested the
same way, but they stay out of the default channels:

| Where | Stable release | Pre-release |
|-------|----------------|-------------|
| GitHub release | latest | marked *Pre-release* |
| Docker | `:<version>` and `:latest` | `:<version>` only (`:latest` stays on the last stable) |
| npm | dist-tag `latest` | dist-tag `next`: `npm install zeroday-cli@next` (or `@$V`) |

Check that a candidate did not move the stable channels:

```bash
npm view zeroday-cli dist-tags          # latest = last stable, next = the candidate
docker buildx imagetools inspect ghcr.io/pandeyaby/zeroday:latest   # digest of the last stable
```

## npm package

```bash
npm install "zeroday-cli@$V" && npm audit signatures
```

## What this does not prove

A valid signature says *where and how* an artifact was built, not that it is
free of bugs. Vulnerability reports: [SECURITY.md](../SECURITY.md).
