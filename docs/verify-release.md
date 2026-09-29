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

Applies from the first release after 0.10.0. Replace `0.11.0` below with the version you use.

## CLI tarball and SBOM

Download `zeroday-cli-0.11.0.tgz`, `zeroday-cli-0.11.0.cdx.json` and `SHA256SUMS`
from the [release page](https://github.com/pandeyaby/ZERODAY/releases), then:

```bash
sha256sum -c SHA256SUMS
gh attestation verify zeroday-cli-0.11.0.tgz --repo pandeyaby/ZERODAY
gh attestation verify zeroday-cli-0.11.0.cdx.json --repo pandeyaby/ZERODAY
```

`gh attestation verify` confirms the file was built by this repository's
release workflow from the tagged commit, and prints that commit.

## Docker image

```bash
# Sigstore signature, bound to the release workflow on a version tag
cosign verify ghcr.io/pandeyaby/zeroday:0.11.0 \
  --certificate-identity-regexp '^https://github.com/pandeyaby/ZERODAY/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# GitHub build-provenance attestation
gh attestation verify oci://ghcr.io/pandeyaby/zeroday:0.11.0 --repo pandeyaby/ZERODAY

# SBOM and SLSA provenance that BuildKit attached to the image
docker buildx imagetools inspect ghcr.io/pandeyaby/zeroday:0.11.0 --format '{{ json .SBOM }}'
docker buildx imagetools inspect ghcr.io/pandeyaby/zeroday:0.11.0 --format '{{ json .Provenance }}'
```

Pin the image by the digest `cosign verify` prints (`ghcr.io/pandeyaby/zeroday@sha256:…`)
if you need a reproducible deployment; `:latest` and version tags can move.

## npm package

```bash
npm install zeroday-cli && npm audit signatures
```

## What this does not prove

A valid signature says *where and how* an artifact was built, not that it is
free of bugs. Vulnerability reports: [SECURITY.md](../SECURITY.md).
