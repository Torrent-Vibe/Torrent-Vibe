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
- A shared Add Torrent sheet for URLs, local `.torrent` files, advanced options, and direct Mikan episode imports.
- Safe task deletion, per-task category/tag/rate-limit editing, and bulk pause/resume/delete controls.
- Helper discovery, pairing, Keychain credentials, explicit credential profile upload/pull, revision-safe subscriptions, backfill, and retry.
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

## TestFlight automation

Pushes to `main` automatically run `.github/workflows/ios-testflight.yml` when
the iOS application, resources, project configuration, or generated Xcode
project changes. Markdown-only and test-only changes do not publish a build.
The workflow can also be dispatched manually from `main`.

The job uses the stable Xcode 26.6 toolchain on GitHub's `macos-26` runner. It
archives with explicit App Store provisioning profiles for the application,
Share Extension, and Live Activity Extension; uploads an internal-only
TestFlight build; waits for App Store Connect processing; and associates the
valid build with the existing `Internal Testing` group. Build numbers derive
from the GitHub workflow run number; rerun attempts receive a distinct suffix.

Publishing credentials are scoped to the GitHub `testflight` Environment:

- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_PRIVATE_KEY`
- `IOS_DISTRIBUTION_CERTIFICATE_P12`
- `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`
- `IOS_APP_STORE_PROVISIONING_PROFILE`
- `IOS_LIVE_ACTIVITY_APP_STORE_PROVISIONING_PROFILE`
- `IOS_SHARE_APP_STORE_PROVISIONING_PROFILE`

`APPLE_TEAM_ID` remains a repository secret shared with the desktop release
workflow. The API key uploads and distributes builds; the certificate and three
profiles provide manual App Store signing without granting the CI key cloud
signing access. The application and Share Extension profiles must include
`group.dev.innei.torrent-vibe`. No signing credentials are stored in the
repository.

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
