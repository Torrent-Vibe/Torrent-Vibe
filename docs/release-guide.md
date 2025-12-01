# Release Checklist

## Prerequisites
- Set `GH_TOKEN`
- `pnpm install`

## Build & Publish
```
pnpm run native:build
pnpm run native:prepare
pnpm run security:prepare
pnpm electron:publish
```

## Release Assets
- `manifest.yaml`
- `Torrent.Vibe-<version>-linux-x64.AppImage`
- `Torrent.Vibe-<version>-windows-x64.exe`
- `Torrent.Vibe-darwin-arm64.zip`
- `Torrent.Vibe-darwin-x64.zip`
- `Torrent.Vibe-<version>-web.tar.gz`
- `latest.yml`
- `latest-linux.yml`
- `latest-mac.yml`

