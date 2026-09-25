#!/bin/bash
set -e

if [ "$(uname)" != "Darwin" ]; then
  echo "Skipping Sparkle bridge build: not on Darwin"
  exit 0
fi

pnpm exec electron-sparkle-updater rebuild --arch arm64
