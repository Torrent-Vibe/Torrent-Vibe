#!/bin/zsh

set -euo pipefail
cd "$(dirname "$0")"

echo "[i] unlocking keychain..."
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_DB"

KEYCHAIN_LIST=$(security list-keychains | xargs)
if [[ "$KEYCHAIN_LIST" != *"$KEYCHAIN_DB"* ]]; then
  echo "[i] adding $KEYCHAIN_DB to keychain list"
  security list-keychains -s $(security list-keychains | xargs) "$KEYCHAIN_DB"
fi
