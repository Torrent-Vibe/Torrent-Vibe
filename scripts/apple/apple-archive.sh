#!/bin/zsh

# 将 GitHub 下载的安装包打包成 xcarchive

set -euo pipefail

rm -rf $ARCHIVES_DIR || true
mkdir -p $ARCHIVES_DIR

cp -a "$ARCHIVES_TEMPLATE" "$ARCHIVES_ARM64"
cp -a "$ARCHIVES_TEMPLATE" "$ARCHIVES_X64"

echo "[*] processing arm64 archive..."
unzip -q \
  -o $WORKING_INPUT_ARM64 \
  -d $ARCHIVES_ARM64/dump
find $ARCHIVES_ARM64/dump \
  -maxdepth 1 \
  -name "*.app" \
  -exec mv "{}" \
  $ARCHIVES_ARM64/Products/Applications/ \;
rm -rf $ARCHIVES_ARM64/dump

echo "[*] generating manifest plist..."
mv $ARCHIVES_ARM64/InfoPlist.template $ARCHIVES_ARM64/Info.plist
sed -i '' "s/\${PRODUCT_NAME}/$PRODUCT_NAME/g" $ARCHIVES_ARM64/Info.plist
sed -i '' "s/\${SIGNING_IDENTITY}/$SIGNING_IDENTITY/g" $ARCHIVES_ARM64/Info.plist
sed -i '' "s/\${SIGNING_TEAM}/$SIGNING_TEAM/g" $ARCHIVES_ARM64/Info.plist
sed -i '' "s/\${ARCHIVES_DATE}/$ARCHIVES_DATE/g" $ARCHIVES_ARM64/Info.plist
sed -i '' "s/\${BUNDLE_IDENTIFIER}/$BUNDLE_IDENTIFIER/g" $ARCHIVES_ARM64/Info.plist
/usr/libexec/PlistBuddy -c "Add :ApplicationProperties:Architectures:0 string arm64" $ARCHIVES_ARM64/Info.plist
plutil -lint $ARCHIVES_ARM64/Info.plist

echo "[*] processing x64 archive..."
unzip -q \
  -o $WORKING_INPUT_X64 \
  -d $ARCHIVES_X64/dump
find $ARCHIVES_X64/dump \
  -maxdepth 1 \
  -name "*.app" \
  -exec mv "{}" \
  $ARCHIVES_X64/Products/Applications/ \;
rm -rf $ARCHIVES_X64/dump

echo "[*] generating manifest plist..."
mv $ARCHIVES_X64/InfoPlist.template $ARCHIVES_X64/Info.plist
sed -i '' "s/\${PRODUCT_NAME}/$PRODUCT_NAME/g" $ARCHIVES_X64/Info.plist
sed -i '' "s/\${SIGNING_IDENTITY}/$SIGNING_IDENTITY/g" $ARCHIVES_X64/Info.plist
sed -i '' "s/\${SIGNING_TEAM}/$SIGNING_TEAM/g" $ARCHIVES_X64/Info.plist
sed -i '' "s/\${ARCHIVES_DATE}/$ARCHIVES_DATE/g" $ARCHIVES_X64/Info.plist
sed -i '' "s/\${BUNDLE_IDENTIFIER}/$BUNDLE_IDENTIFIER/g" $ARCHIVES_X64/Info.plist
/usr/libexec/PlistBuddy -c "Add :ApplicationProperties:Architectures:0 string x86_64" $ARCHIVES_X64/Info.plist
plutil -lint $ARCHIVES_X64/Info.plist

