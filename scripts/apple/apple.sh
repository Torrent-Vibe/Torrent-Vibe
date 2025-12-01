#!/bin/zsh

set -euo pipefail
cd "$(dirname "$0")"

source ./config.sh

./apple-download.sh
./apple-archive.sh
./apple-keychain-unlock.sh
./apple-resign.sh
./apple-notarize.sh

echo "[*] done"
