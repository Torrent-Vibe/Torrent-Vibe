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
   - **macOS** (arm64 only): builds the dmg + zip; if the five Apple signing
     secrets are set, Developer-ID-signs + notarizes + staples the app
     (otherwise ad-hoc signs as before); signs the update archive and
     generates a Sparkle `appcast.xml` (with delta updates against the
     previous release); publishes the GitHub Release with the dmg, zip, and
     appcast as assets.
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

### Optional — Apple Developer ID + notarization (all five or none)

When **all five** are present, the macOS job signs with Developer ID, submits
to Apple notary (bounded wait via `.github/scripts/notarize-and-staple.sh`),
staples the ticket, and rebuilds dmg/zip from the stapled `.app`. When
**none** are present, the release stays ad-hoc signed (first launch needs
right-click → Open). A partial set fails the job — a signed-but-unnotarized
app is still blocked by Gatekeeper.

| Secret | What it is |
| --- | --- |
| `CSC_LINK` | base64 of the Developer ID Application `.p12` |
| `CSC_KEY_PASSWORD` | password for that `.p12` |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password for that Apple ID |
| `APPLE_TEAM_ID` | 10-char Team ID (e.g. `KAMM5N88X3`) |

```bash
# CSC_LINK from a local .p12
base64 -i Certificates.p12 | gh secret set CSC_LINK -R Torrent-Vibe/Torrent-Vibe
gh secret set CSC_KEY_PASSWORD -R Torrent-Vibe/Torrent-Vibe
gh secret set APPLE_ID -R Torrent-Vibe/Torrent-Vibe
gh secret set APPLE_APP_SPECIFIC_PASSWORD -R Torrent-Vibe/Torrent-Vibe
gh secret set APPLE_TEAM_ID -R Torrent-Vibe/Torrent-Vibe -b 'KAMM5N88X3'
```

Do not submit many notarizations in parallel — Apple's queue will stall for
hours. Prefer one release-time submit; keep branch/preview builds unsigned or
sign-only without notary.

## Local validation before releasing

Run `pnpm release:dry-run` (or `bash scripts/release-dry-run.sh`) on macOS
before tagging a real release. It builds an old and a new version locally,
signs them with a throwaway EdDSA keypair, generates an appcast, and verifies
the signature, delta, and XML structure end to end — without touching any
repo secrets or publishing anything.
