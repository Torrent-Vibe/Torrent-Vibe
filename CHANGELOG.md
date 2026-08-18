# Changelog

## 1.1.0

- After pairing, you can upload or pull provider credentials (Mikan,
  TMDB, M-Team, OpenAI, and others) through the helper so other devices
  share the same keys.
- One helper can pair with several Torrent Vibe clients at once. Each
  client gets its own token; unpairing one does not kick the others.
- Discover's Mikan workspace now shares one Browse surface for the
  season wall and search. Bangumi detail is a stack instead of tabs.
- Unsubscribing from a Mikan show removes its torrents from qBittorrent
  and asks whether to delete the files on disk.
- The helper now fetches torrent bytes before adding, picks one
  language/resolution per episode, and names paths as series/season.
- Fixed a crash where writing to a closed stdout or stderr pipe could
  take down the Electron process.

## 1.0.4

- Added a download-host helper you can install as a single Linux binary. Pair
  it from Settings, then Mikan subscriptions keep adding and renaming episodes
  after Torrent Vibe quits.
- Helper settings (library root, category, local qBittorrent URL) can be
  edited from the app after pairing. Unbinding stops that helper.
- The pairing panel can list helpers on the local network and copy an install
  command. Failed or unparseable episodes can be retried.

## 1.0.3

- Fixed uneven padding and mismatched corner radius on the segmented tab
  control (torrent detail panel tabs and settings appearance toggles): the
  active pill now sits with equal spacing on all sides and its corners stay
  concentric with the container.

## 1.0.2

- Fixed Sparkle delta updates on macOS: delta files are now uploaded under
  GitHub-safe asset names, so the appcast's delta URLs no longer 404 and
  updates between consecutive versions download the small delta instead of
  falling back to the full archive.

## 1.0.1

- Fixed the Linux AppImage build failing during packaging: the fuse-flipping
  step looked for the executable by product name instead of the actual
  lowercase binary name, so 1.0.0 shipped without a Linux build.

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
