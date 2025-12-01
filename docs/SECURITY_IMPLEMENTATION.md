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

---

Last updated: 2025-12-01