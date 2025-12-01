Hot Update Manifest (YAML)

Overview
- Purpose: Drive renderer hot updates with integrity and compatibility info without modifying the encrypted package format.
- Format: YAML only (no JSON). Parsed with js-yaml in the main process.

Fields
- version: Renderer version string used for display and folder name.
- asset_name: Binary asset filename (e.g., renderer-dist-encrypted.bin).
- asset_size: Integer; size in bytes of the asset.
- asset_sha256: Hex; SHA-256 of the asset (validated after download).
- required_main_hash: Optional hex; must equal the packaged package.json mainHash to install.
- created_at: ISO-8601 timestamp for auditing.

Example
  version: 1.2.3
  asset_name: renderer-dist-encrypted.bin
  asset_size: 10485760
  asset_sha256: 9e6f5a...c0fe
  required_main_hash: 4d2a1c...beef
  created_at: 2025-09-05T10:00:00Z

Main Hash Definition
- mainHash is computed over dist/main and dist/preload using a stable algorithm:
  - Recursively list files; sort paths.
  - For each file, hash the relative path and file content bytes.
  - SHA-256 of the concatenation.
- Packaged builds: forge afterCopy writes mainHash into packaged package.json.
- Development: scripts/write-main-hash-dev.js computes and writes mainHash to package.json before electron:dev.

Pipelines
- Renderer release workflow (renderer-release.yml):
  - Build renderer; produce encrypted package.
  - Compute SHA-256 and generate manifest.yaml via scripts/generate-release-manifest.js.
  - Optionally set required_main_hash to the desktop build’s mainHash.
  - Upload both encrypted package and manifest.yaml to GitHub release.

- Desktop build workflow (build.yml):
  - After assembling artifacts, generate release/manifest.yaml with main_hash via scripts/generate-app-build-manifest.js and upload.

Runtime Flow
- App queries latest release; looks for manifest.yaml.
- Validates asset_sha256 after download (and signature/decryption as usual).
- If required_main_hash present, compares to package.json mainHash; only compatible updates are applied.

Dev Debugging
- Prepare a folder containing manifest.yaml and the encrypted asset.
- Start with UPDATE_DEBUG_DIR=/path/to/folder pnpm electron:dev.
- The app reads file://manifest.yaml, validates asset_sha256, checks required_main_hash (using dev-computed mainHash), and installs the update.

