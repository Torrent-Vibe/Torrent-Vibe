#!/bin/zsh

set -euo pipefail
cd "$(dirname "$0")"

source ./config.sh

# 此脚本共 GitHub Action 使用
# 需要传入 arm64 和 amd64 两个架构的 zip 包
# 同时如果提供了 EXPORT_DIR 则会将最终产物复制到该目录

local IMPORT_ARM64_PACKAGE=""
local IMPORT_AMD64_PACKAGE=""
local EXPORT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --import-arm64)
      IMPORT_ARM64_PACKAGE="$2"
      shift 2
      ;;
    --import-amd64)
      IMPORT_AMD64_PACKAGE="$2"
      shift 2
      ;;
    --export-dir)
      EXPORT_DIR="$2"
      shift 2
      ;;
    *)
      echo "[-] unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$IMPORT_ARM64_PACKAGE" || ! -f "$IMPORT_ARM64_PACKAGE" ]]; then
  echo "[-] variable from --import-arm64 is broken."
  exit 1
fi
if [[ -z "$IMPORT_AMD64_PACKAGE" || ! -f "$IMPORT_AMD64_PACKAGE" ]]; then
  echo "[-] variable from --import-amd64 is broken."
  exit 1
fi

IMPORT_ARM64_PACKAGE=$(realpath "$IMPORT_ARM64_PACKAGE")
IMPORT_AMD64_PACKAGE=$(realpath "$IMPORT_AMD64_PACKAGE")
mkdir -p "$(dirname "$WORKING_INPUT_ARM64")"
mkdir -p "$(dirname "$WORKING_INPUT_X64")"
cp -f "$IMPORT_ARM64_PACKAGE" "$WORKING_INPUT_ARM64"
cp -f "$IMPORT_AMD64_PACKAGE" "$WORKING_INPUT_X64"

echo "[i] continue general notary process..."

./apple-keychain-unlock.sh
./apple-archive.sh
./apple-resign.sh
./apple-notarize.sh

if [[ -n "$EXPORT_DIR" ]]; then
  echo "[*] copying final packages to $EXPORT_DIR"
  mkdir -p "$EXPORT_DIR"
  cp -a "$FINAL_PACKAGE_ARM64" "$EXPORT_DIR/"
  cp -a "$FINAL_PACKAGE_X64" "$EXPORT_DIR/"
fi

echo "[*] done."