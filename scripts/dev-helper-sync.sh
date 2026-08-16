#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/apps/helper-go"
OUT="$SRC/torrent-vibe-helper_linux_amd64"
HOST="${HELPER_SSH:?set HELPER_SSH to user@host of the download machine}"
REMOTE_BIN="${HELPER_REMOTE_BIN:-.local/bin/torrent-vibe-helper}"
SERVICE="${HELPER_REMOTE_SERVICE:-torrent-vibe-helper.service}"
GO_IMAGE="${HELPER_GO_IMAGE:-golang:1.25-bookworm}"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
if git -C "$ROOT" status --porcelain -- apps/helper-go | grep -q .; then
  VERSION="dev-$SHA-dirty"
else
  VERSION="dev-$SHA"
fi

echo "[helper-sync] building linux/amd64 $VERSION in $GO_IMAGE"
docker run --rm --platform linux/amd64 \
  -v "$SRC:/src" \
  -v helper-go-mod:/go/pkg/mod \
  -w /src \
  -e CGO_ENABLED=0 \
  "$GO_IMAGE" \
  go build -trimpath -ldflags "-s -w -X main.version=$VERSION" \
    -o /src/torrent-vibe-helper_linux_amd64 \
    ./cmd/torrent-vibe-helper

test -x "$OUT"
echo "[helper-sync] $(ls -lh "$OUT" | awk '{print $5}') -> $HOST:$REMOTE_BIN"

scp -q "$OUT" "$HOST:/tmp/torrent-vibe-helper.next"
ssh -o BatchMode=yes "$HOST" "set -euo pipefail
install -m 755 /tmp/torrent-vibe-helper.next \"\$HOME/$REMOTE_BIN\"
rm -f /tmp/torrent-vibe-helper.next
systemctl --user restart \"$SERVICE\"
"

echo "[helper-sync] waiting for /discover"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if BODY="$(curl -fsS --connect-timeout 2 "http://${HOST#*@}:17890/discover" 2>/dev/null)"; then
    echo "[helper-sync] $BODY"
    echo "$BODY" | grep -q "$VERSION" || echo "[helper-sync] warning: running helper did not report $VERSION"
    exit 0
  fi
  sleep 1
done

echo "[helper-sync] helper did not answer on :17890" >&2
exit 1
