#!/bin/zsh

# 上传到苹果公证服务并等待

set -euo pipefail

SUBMISSION_DIR="$WORKING_DIR/submission"
rm -rf "$SUBMISSION_DIR" || true
mkdir -p "$SUBMISSION_DIR"

SUBMISSION_DIR_ARM64="$SUBMISSION_DIR/arm64"
SUBMISSION_DIR_X64="$SUBMISSION_DIR/x64"
mkdir -p "$SUBMISSION_DIR_ARM64"
mkdir -p "$SUBMISSION_DIR_X64"

SUBMISSION_PACKAGE_ARM64="$SUBMISSION_DIR_ARM64/arm64.zip"
SUBMISSION_PACKAGE_X64="$SUBMISSION_DIR_X64/x64.zip"

echo "[*] gathering data..."
cp -a "$ARCHIVES_ARM64/Products/Applications/$PRODUCT_NAME.app" "$SUBMISSION_DIR_ARM64/"
cp -a "$ARCHIVES_X64/Products/Applications/$PRODUCT_NAME.app" "$SUBMISSION_DIR_X64/"

find "$SUBMISSION_DIR_ARM64" -name ".DS_Store" -type f -exec rm -rf {} \; 
find "$SUBMISSION_DIR_X64" -name ".DS_Store" -type f -exec rm -rf {} \; 

pushd "$SUBMISSION_DIR_ARM64" > /dev/null
echo "[*] creating package $(basename $SUBMISSION_PACKAGE_ARM64)..."
/usr/bin/ditto -c -k --keepParent "$PRODUCT_NAME.app" "$SUBMISSION_PACKAGE_ARM64"
popd > /dev/null

pushd "$SUBMISSION_DIR_X64" > /dev/null
echo "[*] creating package $(basename $SUBMISSION_PACKAGE_X64)..."
/usr/bin/ditto -c -k --keepParent "$PRODUCT_NAME.app" "$SUBMISSION_PACKAGE_X64"
popd > /dev/null

echo "[*] submitting for notarization..."

xcrun notarytool submit "$SUBMISSION_PACKAGE_ARM64" \
  --keychain-profile "$NOTARIZE_KEYCHAIN_PROFILE" \
  --keychain "$KEYCHAIN_DB" \
  --timeout 3600 \
  --wait &

xcrun notarytool submit "$SUBMISSION_PACKAGE_X64" \
  --keychain-profile "$NOTARIZE_KEYCHAIN_PROFILE" \
  --keychain "$KEYCHAIN_DB" \
  --timeout 3600 \
  --wait &

wait

echo "[*] notarization wait complete, cleaning up..."
rm -rf "$SUBMISSION_PACKAGE_ARM64"
rm -rf "$SUBMISSION_PACKAGE_X64"

echo "[*] stapling notarization ticket..."
xcrun stapler staple "$SUBMISSION_DIR_ARM64/$PRODUCT_NAME.app"
xcrun stapler staple "$SUBMISSION_DIR_X64/$PRODUCT_NAME.app"
spctl --assess --type execute --verbose=4 "$SUBMISSION_DIR_ARM64/$PRODUCT_NAME.app"
spctl --assess --type execute --verbose=4 "$SUBMISSION_DIR_X64/$PRODUCT_NAME.app"

echo "[*] creating final packages..."
mkdir -p "$FINAL_PACKAGE_DIR"

pushd "$SUBMISSION_DIR_ARM64" > /dev/null
echo "[*] creating package $(basename $FINAL_PACKAGE_ARM64)..."
zip -r -y -q "$FINAL_PACKAGE_ARM64" "$PRODUCT_NAME.app"
popd > /dev/null

pushd "$SUBMISSION_DIR_X64" > /dev/null
echo "[*] creating package $(basename $FINAL_PACKAGE_X64)..."
zip -r -y -q "$FINAL_PACKAGE_X64" "$PRODUCT_NAME.app"
popd > /dev/null
