# Torrent Vibe for iOS

UIKit-led native foundation for the Torrent Vibe mobile client, with SwiftUI
used only as embedded feature content.

## Current scope

- UIKit application lifecycle, `UITabBarController`, and `UINavigationController` shell.
- Torrent, Discover, Servers, and Settings feature boundaries.
- SwiftUI leaf content embedded by UIKit-owned view controllers through `UIHostingController`.
- Local persistence for non-sensitive server metadata.
- Explicit service protocols for qBittorrent tasks and the host Helper JSON API.
- A deterministic `-ui-demo` launch mode for Simulator review.

Authentication, Keychain storage, live qBittorrent requests, Mikan content, and
Helper pairing are intentionally outside this foundation change.

## Generate and build

```bash
cd apps/ios
xcodegen generate
xcodebuild \
  -project TorrentVibe.xcodeproj \
  -scheme TorrentVibe \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  build
```

The Xcode project is generated from `project.yml` and is committed so the app
can be opened without requiring XcodeGen.

## Architecture seam

```text
UIApplicationDelegate / UIWindowSceneDelegate
      │
      ▼
UITabBarController
      │
      ▼
UINavigationController
      │
      ▼
UIKit feature view controller
      │ embeds
      ▼
UIHostingController<SwiftUI leaf content>
      │
      ▼
AppModel ─┬─> TorrentRepository ──> qBittorrent WebAPI (next phase)
          └─> HelperService ──────> Helper plain JSON API (next phase)
```
