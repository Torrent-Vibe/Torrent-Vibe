#!/bin/zsh

# 将 xcarchive 重新签名并准备公证

set -euo pipefail

echo "[i] using keychain at $KEYCHAIN_DB"

function sign_item() {
  local item_path="$1"

  local sign_cmd_args=(
    "-f"
    "-s" "$CODE_SIGNING_IDENTITY"
    "--timestamp"
    "--force"
    "--generate-entitlement-der"
    "--strip-disallowed-xattrs"
    "--options" "runtime"
    "--keychain" "$KEYCHAIN_DB"
  )
  if [[ "$item_path" == *.app ]]; then
    echo "[+] signing $(basename "$item_path") with entitlements"
    sign_cmd_args+=("--entitlements" "$CODE_SIGNING_ENTITLEMENTS")
  else
    echo "[+] signing $(basename "$item_path")"
  fi

  xattr -cr "$item_path"
  /usr/bin/codesign "${sign_cmd_args[@]}" "$item_path" > /dev/null 2>&1
  /usr/bin/codesign --verify --deep --strict --keychain "$KEYCHAIN_DB" "$item_path" > /dev/null 2>&1
}

function process_app_bundle() {
  local app_path="$1"
  echo "[*] processing $(basename "$app_path")"

  echo "[*] removing existing signatures..."
  find "$app_path" -name "_CodeSignature" -type d -exec rm -rf {} \; 2>/dev/null || true
  find "$app_path" -name "embedded.provisionprofile" -type f -exec rm -rf {} \; 2>/dev/null || true

  echo "[*] scanning for sign candidates..."
  FILE_CANDIDATES=()
  while IFS= read -r ITEM; do
    FILE_CANDIDATES+=("$ITEM")
  done < <(python3 "$(dirname "$0")/apple-resign-scan.py" "$1")

  echo "[*] found ${#FILE_CANDIDATES[@]} candidates to sign"
  for ITEM in "${FILE_CANDIDATES[@]}"; do
    sign_item "$ITEM"
  done
}

process_app_bundle "$ARCHIVES_ARM64/Products/Applications/$PRODUCT_NAME.app" &
process_app_bundle "$ARCHIVES_X64/Products/Applications/$PRODUCT_NAME.app" &

wait
