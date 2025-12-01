# Security Hardening and Build Controls (Summary)

This document summarizes the security plan, key modifications, and build controls implemented during our conversation to protect the Electron application against tampering and reverse engineering.

## Goals

- Protect packaged code from easy inspection and patching (renderer/main/preload obfuscation).
- Enforce runtime app integrity (ASAR signature verification; fail-closed policy).
- Keep everything local (no server dependency) while supporting CI-driven signing.
- Provide clear build-time controls for Trial vs. non-Trial builds.

## High‑Level Architecture

- Source protection: Vite/Electron-vite post-bundle obfuscation (opt-in via env) for renderer, main, and preload.
- Integrity verification: Native addon computes SHA-256; main process verifies Ed25519 signature over digest using packaged public key. No SHA-256 fallback.
- Packaging layout: Native addon outside ASAR under `Resources/native`, public key under `Resources/security`.
- Build-time trial flag: Global `__TRIAL__` injected into main/preload/renderer from env.
- CI pipeline: Generates or injects keys; signs ASAR at packaging time; verifies signatures.

## Key Changes (Files and Behavior)

### Obfuscation (opt-in)

- `plugins/vite/security-obfuscation-plugin.ts`
  - Post-bundle obfuscation in production when `SECURITY_OBFUSCATION=1`.
  - Integrated in:
    - `vite.config.ts` (renderer)
    - `electron.vite.config.ts` (main + preload)
  - Default: disabled in development.

### Native Addon and Integrity

- `layer/main/src/native/security-module/`
  - `binding.gyp`, `src/secure_addon.cc`, `src/crypto_util.cc`, headers.
  - Exposes `sha256FileHex(path)` and simple `{ ok: boolean }` checks (legacy signatures removed).
  - No weak RNG or embedded secrets; signing moved out of native.

- Native placement (outside ASAR):
  - `scripts/prepare-native.js` copies compiled `.node` to `resources/native/security_module.node`.
  - `forge.config.mts` uses `extraResource: ['./resources/native']` to package native into `Resources/native`.

### ASAR Signature (signature-only; no .sha256 fallback)

- Signing: `scripts/sign-asar.js`
  - Scans `./out` for `.asar`, computes SHA-256, signs digest with Ed25519 (Node crypto), writes `<asar>.sig` next to it.
  - Private key sources:
    - `SIGN_ASAR_PRIVKEY_PEM` or `SIGN_ASAR_PRIVKEY_PATH` (CI/Secrets)
    - Otherwise, dev keypair under `resources/security` (auto-generated).
  - Cleans legacy `<asar>.sha256` files if present.

- Verification (runtime): `layer/main/src/services/security-service.ts`
  - Loads public key from `Resources/security/asar_pubkey.pem` (or env override).
  - Computes SHA-256 via native, verifies `app.asar.sig` only (no .sha256 path).
  - Fail-closed policy in packaged builds unless `SECURITY_ALLOW_NO_SIG=1`.
  - Writes debug logs to `userData/security-debug.log` and console.

- Verification (tooling): `scripts/verify-build-integrity.js`
  - Recursively scans `./out` for `.asar` files.
  - Prints SHA-512 and SHA-256; verifies signature using packaged public key or env overrides.
  - `--strict` / `VERIFY_STRICT=1`: requires valid signature + public key.

### Forge Configuration

- `forge.config.mts`
  - `extraResource`: `./resources/native`, `./resources/security`.
  - `hooks.postPackage`: runs `node scripts/sign-asar.js` (signs ASAR inside the `.app` before `.dmg/.zip` are created). Ensures `.sig` is packaged into all final artifacts.
  - Removed unused `copyNativeSecurityModule` function.
  - Fuses already enabled: Only load from ASAR and embedded integrity validation.

### Security Logs

- `layer/main/src/services/security-service.ts`
  - File log at: `~/Library/Application Support/<AppName>/security-debug.log` (macOS; platform‐specific userData path on other OS).
  - Logs: native loaded, app signature result, ASAR paths, SIG verify result, license verify (optional), init success/failure.

### Trial/Pro Control (Runtime)

- Trial vs Pro is now resolved at runtime by the renderer license store (`layer/renderer/src/stores/license.store.ts`).
- Build-time flag `__TRIAL__` remains defined as `false` for compatibility but is not used to gate features.
- UI reads the effective state via `useTrialMode()` (React) or `isTrial()` (non-React).

### CI Workflow

- `.github/workflows/build.yml`
  - Added input `build_trial` (boolean) to control trial builds.
  - Passes `TRIAL` env to build steps across platforms.
  - `postPackage` hook ensures `app.asar.sig` is created inside `.app` before `.dmg`/`.zip` are made.

## Build Commands and Env

- Trial-specific build variants have been removed. Use standard build commands; runtime activation switches Trial → Pro.

- Secure builds:
  - Electron (all platforms): `pnpm electron:build:secure` (includes obfuscation and integrity checks).
  - macOS dual-arch example in CI uses direct `electron-vite build` + `electron-forge make`.

- Obfuscation (opt-in): `SECURITY_OBFUSCATION=1`.

- Signature keys:
  - Public key packaged: `resources/security/asar_pubkey.pem`.
  - Private key for CI signing: `SIGN_ASAR_PRIVKEY_PEM` or `SIGN_ASAR_PRIVKEY_PATH`.
  - Dev keypair (for local builds) auto-generated by `scripts/ensure-security-resources.js`.

- Integrity verification:
  - Tool: `pnpm verify:asar` (add `--strict` or `VERIFY_STRICT=1`).
  - Runtime: fail-closed if signature/public key missing; override with `SECURITY_ALLOW_NO_SIG=1` for debugging.

## Rationale and Security Notes

- Removed SHA-256 fallback: Prevents trivial tampering by modifying both `app.asar` and `.sha256`.
- Signature-only (Ed25519 over SHA-256 digest): Only someone with the private key can produce a valid `.sig`.
- Public key is non-sensitive and packaged with the app.
- Native addon is outside ASAR to allow loading `.node` modules reliably.
- Obfuscation is optional to balance security and performance; enable only in production.

## Troubleshooting

- App quits on startup with integrity failure:
  - Confirm `Resources/app.asar.sig` exists and `Resources/security/asar_pubkey.pem` is packaged.
  - Run `pnpm verify:asar` to check signature validity.
  - Review `security-debug.log` under userData path.
  - For quick diagnostics, launch from terminal and optionally set `SECURITY_ALLOW_NO_SIG=1`.

## Future Enhancements

- Platform code-sign validation (macOS SecCode, Windows WinVerifyTrust).
- Structured native return codes (e.g., FILE_NOT_FOUND, SIG_INVALID) for richer telemetry.
- Signed license object with key rotation (local only, still serverless).
- Harden preload and DevTools flags in production (CSP, debug toggles).

---

Last updated: 2025-08-28
