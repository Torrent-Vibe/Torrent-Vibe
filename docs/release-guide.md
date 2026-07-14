# Release Guide

## How a release happens

1. Bump `version` in the root `package.json` (semantic versioning) and add a
   matching `## X.Y.Z` section to `CHANGELOG.md` describing the release from a
   user's perspective. Both changes must land on `main` in the same PR.
2. Once merged to `main`, the `desktop-tag` workflow
   (`.github/workflows/desktop-tag.yml`) fires automatically: it reads the new
   version, creates a `desktop-vX.Y.Z` tag, and dispatches the
   `desktop-release` workflow. If that tag already exists, it does nothing.
3. `desktop-release` (`.github/workflows/desktop-release.yml`) builds and
   publishes the release:
   - **macOS** (arm64 only): builds the dmg + zip, ad-hoc signs the app,
     signs the update archive and generates a Sparkle `appcast.xml` (with
     delta updates against the previous release), and publishes the GitHub
     Release with the dmg, zip, and appcast as assets.
   - **Windows** (x64, NSIS): builds the installer and uploads the `.exe`,
     `latest.yml`, and `.blockmap` to the same release.
   - **Linux** (x64, AppImage): builds the AppImage (with its differential
     update blockmap embedded in the file) and uploads it along with
     `latest-linux.yml` to the same release.
   - Release notes are extracted from the `CHANGELOG.md` section matching the
     released version and used as both the GitHub Release body and the
     Sparkle appcast description. **The CHANGELOG section is mandatory** —
     the workflow fails before building anything if it's missing or empty.

macOS builds first; Windows and Linux only run after the macOS job succeeds
and publishes the release (they upload assets onto it).

## Required repo secrets

- `SPARKLE_ED_PUBLIC_KEY` / `SPARKLE_ED_PRIVATE_KEY` — the EdDSA keypair used
  to sign Sparkle update archives and appcast entries. Generate them once with
  Sparkle's `generate_keys` tool (bundled in the Sparkle release tarball) and
  store both halves as repo secrets. The workflow fails fast if either is
  missing or empty.

## Local validation before releasing

Run `pnpm release:dry-run` (or `bash scripts/release-dry-run.sh`) on macOS
before tagging a real release. It builds an old and a new version locally,
signs them with a throwaway EdDSA keypair, generates an appcast, and verifies
the signature, delta, and XML structure end to end — without touching any
repo secrets or publishing anything.
