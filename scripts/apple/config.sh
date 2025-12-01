#!/bin/zsh

set -euo pipefail

export CURRENT_DIR=$(pwd)
export WORKING_DIR=$(pwd)/Contents
rm -rf $WORKING_DIR || true
mkdir -p $WORKING_DIR

# 下载脚本
export WORKING_INPUT_ARM64="$WORKING_DIR/input/arm64.zip"
export WORKING_INPUT_X64="$WORKING_DIR/input/x64.zip"
export REPO="Innei/qb-webui"

# 归档脚本
export PRODUCT_NAME="Torrent Vibe"
export SIGNING_IDENTITY="Apple Development: ZIKAN WANG (QXJU83P7SM)"
export SIGNING_TEAM="964G86XT2P"
export BUNDLE_IDENTIFIER="wiki.qaq.vibe.torrent"
export ARCHIVES_DIR="$WORKING_DIR/archives"
export ARCHIVES_TEMPLATE="$CURRENT_DIR/ArchiveTemplate.xcarchive"
export ARCHIVES_ARM64="$ARCHIVES_DIR/arm64.xcarchive"
export ARCHIVES_X64="$ARCHIVES_DIR/x64.xcarchive"
export ARCHIVES_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 重新签名脚本
export KEYCHAIN_DB=$(pwd)/NotaryKeychain.keychain
export KEYCHAIN_PASSWORD=${KEYCHAIN_PASSWORD:-""}
if [ -z "$KEYCHAIN_PASSWORD" ]; then
  echo "[-] keychain password is not set"
  exit 1
fi
export CODE_SIGNING_IDENTITY="Developer ID Application: ZIKAN WANG (964G86XT2P)"
export CODE_SIGNING_TEAM="964G86XT2P"
export CODE_SIGNING_ENTITLEMENTS="$CURRENT_DIR/Entitlements.plist"

# 公证脚本
export NOTARIZE_KEYCHAIN_PROFILE="Lakr233"
export FINAL_PACKAGE_DIR="$WORKING_DIR/publish"
export FINAL_PACKAGE_ARM64="$FINAL_PACKAGE_DIR/$PRODUCT_NAME-darwin-arm64.zip"
export FINAL_PACKAGE_X64="$FINAL_PACKAGE_DIR/$PRODUCT_NAME-darwin-x64.zip"
