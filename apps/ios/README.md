# Torrent Vibe for iOS

UIKit-led native foundation for the Torrent Vibe mobile client, with SwiftUI
used only as embedded feature content.

## Current scope

- UIKit application lifecycle, `UITabBarController`, and `UINavigationController` shell.
- Tasks, Discover, and Settings root tabs with independent UIKit navigation stacks.
- Server management nested under Settings.
- SwiftUI leaf content embedded by UIKit-owned view controllers through `UIHostingController`.
- Local persistence for non-sensitive server metadata.
- Native qBittorrent Web API login and task loading, with passwords stored only in Keychain.
- A shared Add Torrent sheet for task URLs and direct Mikan episode imports.
- Helper discovery, pairing, Keychain credentials, revision-safe subscriptions, backfill, and retry.
- A bundled JavaScriptCore bridge that reuses the repository Mikan parsers.
- Live Mikan wall, search, and detail requests through native `URLSession`.
- A deterministic `-ui-demo` launch mode for Simulator review.

Helper remains the subscription source of truth; iOS caches snapshots for presentation only.

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
AppModel ─┬─> TorrentRepository ──> qBittorrent WebAPI + Keychain
          ├─> HelperService ──────> Helper v2 JSON API + Helper Keychain
          └─> MikanContentService ─> URLSession ─> MikanParser.js / JavaScriptCore
```
