# Changelog

## 1.0.0

First semantically versioned release. Torrent Vibe's desktop update system
has been rebuilt from the ground up:

- macOS now updates natively through Sparkle, with signed, delta-capable
  updates delivered straight from GitHub Releases.
- Windows and Linux update through the standard `electron-updater` flow.
- macOS builds are now Apple Silicon (arm64) only; Intel Mac builds are no
  longer produced.
- The Windows installer switched from the previous installer to NSIS. Existing
  Windows users will need to manually reinstall once to pick up this change;
  updates after that happen automatically.
- The old renderer hot-update system (encrypted renderer packages, manifest
  files, main-process hash checks) has been removed entirely in favor of full
  native app updates.
- The project now follows semantic versioning going forward — version bumps
  in `package.json` on `main` drive releases directly.
