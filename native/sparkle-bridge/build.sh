#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$(uname)" != "Darwin" ]; then
    echo "Skipping sparkle-bridge build: not on Darwin"
    exit 0
fi

cd "$SCRIPT_DIR"

if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi

npm run build
