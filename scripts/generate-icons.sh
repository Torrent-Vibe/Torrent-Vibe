#!/usr/bin/env bash
#
# generate-icons.sh
#
# Generate multi-platform Electron app icons from a single 512x512 PNG,
# and web favicons under public/ from the same base.
#
# Outputs (in resources/):
#   - icon.png      (Linux, 512x512)
#   - icon.ico      (Windows multi-size, if ImageMagick available)
#   - icon.icns     (macOS, if run on macOS with iconutil)
#   - icon.iconset/ (intermediate macOS iconset directory)
#
# Additional outputs (in public/):
#   - android-chrome-192x192.png
#   - apple-touch-icon.png (180x180)
#   - favicon-16x16.png
#   - favicon-32x32.png
#   - favicon.ico (if ImageMagick available)
#
# Requirements (recommended):
#   macOS: built‑in `sips`, `iconutil`
#   All platforms (optional for .ico): ImageMagick `magick` command
#
# Usage:
#   ./scripts/generate-icons.sh
#   ./scripts/generate-icons.sh --base path/to/source.png
#
# Options:
#   --base <file>   Use a custom source PNG (default: public/android-chrome-512x512.png)
#   --keep-iconset  Do not remove the generated icon.iconset directory
#   --no-ico        Skip generating Windows .ico
#   --no-icns       Skip generating macOS .icns
#   --quiet         Minimal output
#   -h|--help       Show help
#
# Notes:
#   - The source image should ideally be 1024x1024 or 512x512 with transparency.
#   - If the source is smaller than the largest required size, upscaling will occur (not ideal).
#   - Safe to re-run; existing files are overwritten.
#

set -euo pipefail

# ---------------------------
# Defaults / Configuration
# ---------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_BASE_REL="public/base.png"
BASE_IMAGE="$ROOT_DIR/$DEFAULT_BASE_REL"

RESOURCES_DIR="$ROOT_DIR/resources"
ICONSET_DIR="$RESOURCES_DIR/icon.iconset"
LINUX_ICON="$RESOURCES_DIR/icon.png"
MAC_ICNS="$RESOURCES_DIR/icon.icns"
WIN_ICO="$RESOURCES_DIR/icon.ico"

# Public web icon targets
PUBLIC_DIR="$ROOT_DIR/public"
PUBLIC_ANDROID_192="$PUBLIC_DIR/android-chrome-192x192.png"
PUBLIC_APPLE_TOUCH="$PUBLIC_DIR/apple-touch-icon.png" # 180x180
PUBLIC_FAVICON_16="$PUBLIC_DIR/favicon-16x16.png"
PUBLIC_FAVICON_32="$PUBLIC_DIR/favicon-32x32.png"
PUBLIC_FAVICON_ICO="$PUBLIC_DIR/favicon.ico"

MAC_SIZES=(16 32 64 128 256 512)   # We'll also create @2x variants
ICO_SIZES=(16 24 32 48 64 128 256) # Typical multi-size ICO set

DO_ICNS=1
DO_ICO=1
KEEP_ICONSET=0
QUIET=0

# ---------------------------
# Helper Functions
# ---------------------------
log() {
  if [[ $QUIET -eq 0 ]]; then
    echo -e "$*"
  fi
}

warn() {
  echo "WARN: $*" >&2
}

err() {
  echo "ERROR: $*" >&2
  exit 1
}

show_help() {
  sed -n "1,/^set -euo pipefail/d;/^# ---------------------------/q;p" "$0" | sed 's/^# \{0,1\}//'
}

# Resize helper: prefers ImageMagick `magick`, falls back to macOS `sips`.
resize_png() {
  local in="$1" out="$2" size="$3"
  if command -v magick &>/dev/null; then
    magick "$in" -resize "${size}x${size}" "$out"
  elif command -v sips &>/dev/null; then
    sips -z "$size" "$size" "$in" --out "$out" &>/dev/null
  elif command -v convert &>/dev/null; then
    convert "$in" -resize "${size}x${size}" "$out"
  else
    return 1
  fi
}

# ---------------------------
# Parse Args
# ---------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
  --base)
    shift
    [[ $# -gt 0 ]] || err "--base requires a path"
    BASE_IMAGE="$(cd "$ROOT_DIR" && realpath "$1")"
    ;;
  --no-ico)
    DO_ICO=0
    ;;
  --no-icns)
    DO_ICNS=0
    ;;
  --keep-iconset)
    KEEP_ICONSET=1
    ;;
  --quiet)
    QUIET=1
    ;;
  -h | --help)
    show_help
    exit 0
    ;;
  *)
    err "Unknown argument: $1"
    ;;
  esac
  shift
done

# ---------------------------
# Validate Base Image
# ---------------------------
if [[ ! -f "$BASE_IMAGE" ]]; then
  err "Base image not found: $BASE_IMAGE (use --base to override)"
fi

# Basic dimension check (requires ImageMagick or identify)
if command -v identify &>/dev/null; then
  DIMENSION_INFO="$(identify -format '%w %h' "$BASE_IMAGE" 2>/dev/null || true)"
  if [[ -n "$DIMENSION_INFO" ]]; then
    WIDTH="${DIMENSION_INFO%% *}"
    HEIGHT="${DIMENSION_INFO##* }"
    if [[ "$WIDTH" -lt 512 || "$HEIGHT" -lt 512 ]]; then
      warn "Base image is smaller than 512x512 (${WIDTH}x${HEIGHT}); results may be blurry."
    fi
  fi
fi

mkdir -p "$RESOURCES_DIR"
mkdir -p "$PUBLIC_DIR"

# ---------------------------
# Generate Linux (icon.png)
# ---------------------------
log "-> Generating Linux icon (512x512) ..."
cp -f "$BASE_IMAGE" "$LINUX_ICON"
log "   Saved: $LINUX_ICON"

# ---------------------------
# Generate macOS iconset + icns
# ---------------------------
if [[ $DO_ICNS -eq 1 ]]; then
  if [[ "$(uname -s)" != "Darwin" ]]; then
    warn "Skipping .icns generation (not on macOS). Use --no-icns to suppress."
  else
    if ! command -v sips &>/dev/null; then
      warn "sips not found; cannot create iconset. Install Xcode tools. Skipping."
    else
      log "-> Creating macOS iconset ..."
      rm -rf "$ICONSET_DIR"
      mkdir -p "$ICONSET_DIR"

      for size in "${MAC_SIZES[@]}"; do
        double=$((size * 2))
        out_base="$ICONSET_DIR/icon_${size}x${size}.png"
        sips -z "$size" "$size" "$BASE_IMAGE" --out "$out_base" &>/dev/null
        log "   + $out_base"

        # @2x variant
        out_retina="$ICONSET_DIR/icon_${size}x${size}@2x.png"
        if [[ $size -lt 512 ]]; then
          sips -z "$double" "$double" "$BASE_IMAGE" --out "$out_retina" &>/dev/null
        else
          # For 512@2x = 1024, if the base isn't that large, reuse base file
          if command -v sips &>/dev/null && identify "$BASE_IMAGE" &>/dev/null; then
            # Attempt upscale if base smaller
            sips -z "$double" "$double" "$BASE_IMAGE" --out "$out_retina" &>/dev/null || cp -f "$BASE_IMAGE" "$out_retina"
          else
            cp -f "$BASE_IMAGE" "$out_retina"
          fi
        fi
        log "   + $out_retina"
      done

      if command -v iconutil &>/dev/null; then
        log "-> Converting iconset to .icns ..."
        iconutil -c icns "$ICONSET_DIR" -o "$MAC_ICNS" || warn "iconutil failed"
        if [[ -f "$MAC_ICNS" ]]; then
          log "   Saved: $MAC_ICNS"
        fi
        if [[ $KEEP_ICONSET -eq 0 ]]; then
          rm -rf "$ICONSET_DIR"
          log "   Cleaned: icon.iconset (use --keep-iconset to retain)"
        else
          log "   Kept icon.iconset as requested."
        fi
      else
        warn "iconutil not found; cannot produce .icns"
      fi
    fi
  fi
else
  log "-> Skipping macOS .icns (disabled by flag)."
fi

# ---------------------------
# Generate Windows .ico
# ---------------------------
if [[ $DO_ICO -eq 1 ]]; then
  if command -v magick &>/dev/null; then
    log "-> Generating Windows .ico ..."
    TMP_DIR="$(mktemp -d)"
    for size in "${ICO_SIZES[@]}"; do
      magick "$BASE_IMAGE" -resize "${size}x${size}" "$TMP_DIR/${size}.png"
      log "   + $size x $size"
    done
    # Combine into single .ico
    magick $(printf "%s " "$TMP_DIR"/*.png) "$WIN_ICO"
    log "   Saved: $WIN_ICO"
    rm -rf "$TMP_DIR"
  else
    warn "ImageMagick 'magick' not found; skipping .ico generation. Install ImageMagick or use --no-ico to suppress."
  fi
else
  log "-> Skipping Windows .ico (disabled by flag)."
fi

# ---------------------------
# Generate web icons (public/)
# ---------------------------
log "-> Generating web icons under public/ ..."

# android-chrome-192x192.png
if resize_png "$BASE_IMAGE" "$PUBLIC_ANDROID_192" 192; then
  log "   Saved: $PUBLIC_ANDROID_192"
else
  warn "Unable to resize for $PUBLIC_ANDROID_192 (need ImageMagick or sips)."
fi

# apple-touch-icon.png (180x180)
if resize_png "$BASE_IMAGE" "$PUBLIC_APPLE_TOUCH" 180; then
  log "   Saved: $PUBLIC_APPLE_TOUCH"
else
  warn "Unable to resize for $PUBLIC_APPLE_TOUCH (need ImageMagick or sips)."
fi

# favicon 16x16 and 32x32 PNGs
if resize_png "$BASE_IMAGE" "$PUBLIC_FAVICON_16" 16; then
  log "   Saved: $PUBLIC_FAVICON_16"
else
  warn "Unable to resize for $PUBLIC_FAVICON_16 (need ImageMagick or sips)."
fi

if resize_png "$BASE_IMAGE" "$PUBLIC_FAVICON_32" 32; then
  log "   Saved: $PUBLIC_FAVICON_32"
else
  warn "Unable to resize for $PUBLIC_FAVICON_32 (need ImageMagick or sips)."
fi

# favicon.ico (16,32) if magick available
if command -v magick &>/dev/null; then
  log "-> Generating public/favicon.ico ..."
  TMP_F16="$(mktemp).png"
  TMP_F32="$(mktemp).png"
  magick "$BASE_IMAGE" -resize 16x16 "$TMP_F16"
  magick "$BASE_IMAGE" -resize 32x32 "$TMP_F32"
  magick "$TMP_F16" "$TMP_F32" "$PUBLIC_FAVICON_ICO"
  rm -f "$TMP_F16" "$TMP_F32"
  log "   Saved: $PUBLIC_FAVICON_ICO"
else
  warn "ImageMagick 'magick' not found; skipping public/favicon.ico generation."
fi

log ""
log "Done."
log "Generated assets present (if available):"
[[ -f "$LINUX_ICON" ]] && log "  - $(realpath "$LINUX_ICON")"
[[ -f "$MAC_ICNS" ]] && log "  - $(realpath "$MAC_ICNS")"
[[ -f "$WIN_ICO" ]] && log "  - $(realpath "$WIN_ICO")"
[[ -f "$PUBLIC_ANDROID_192" ]] && log "  - $(realpath "$PUBLIC_ANDROID_192")"
[[ -f "$PUBLIC_APPLE_TOUCH" ]] && log "  - $(realpath "$PUBLIC_APPLE_TOUCH")"
[[ -f "$PUBLIC_FAVICON_16" ]] && log "  - $(realpath "$PUBLIC_FAVICON_16")"
[[ -f "$PUBLIC_FAVICON_32" ]] && log "  - $(realpath "$PUBLIC_FAVICON_32")"
[[ -f "$PUBLIC_FAVICON_ICO" ]] && log "  - $(realpath "$PUBLIC_FAVICON_ICO")"

exit 0
