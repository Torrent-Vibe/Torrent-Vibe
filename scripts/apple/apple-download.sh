#!/bin/zsh

# 从 GitHub Release 下载最新的安装包

set -euo pipefail
cd "$(dirname "$0")/"

TMP_DOWNLOAD_DIR=$WORKING_DIR/input
mkdir -p "$TMP_DOWNLOAD_DIR"

ASSET_NAMES=$(gh release view --repo "$REPO" --json assets -q '.assets[].name' || true)
if [[ -z "$ASSET_NAMES" ]]; then
  echo "[-] unable to fetch latest release info." >&2
  exit 1
fi

X64_ASSET=$(echo "$ASSET_NAMES" | grep -E 'macos[-_.]x64\.zip$' | head -1 || true)
ARM64_ASSET=$(echo "$ASSET_NAMES" | grep -E 'macos[-_.]arm64\.zip$' | head -1 || true)
if [[ -z "$X64_ASSET" || -z "$ARM64_ASSET" ]]; then
  echo "[-] unable to find required assets in latest release." >&2
  exit 1
fi

gh release download --repo "$REPO" --dir "$TMP_DOWNLOAD_DIR" --clobber --pattern "$X64_ASSET" &
gh release download --repo "$REPO" --dir "$TMP_DOWNLOAD_DIR" --clobber --pattern "$ARM64_ASSET" &

wait

ZIP_X64="$TMP_DOWNLOAD_DIR/$X64_ASSET"
ZIP_ARM64="$TMP_DOWNLOAD_DIR/$ARM64_ASSET"

mv "$ZIP_X64" "$WORKING_INPUT_X64"
mv "$ZIP_ARM64" "$WORKING_INPUT_ARM64"

echo "[i] release for arm64 available at ${WORKING_INPUT_ARM64}"
echo "[i] release for x64 available at ${WORKING_INPUT_X64}"
