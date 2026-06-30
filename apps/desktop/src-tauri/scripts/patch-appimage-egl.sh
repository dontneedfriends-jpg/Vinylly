#!/usr/bin/env bash
# Post-build AppImage patcher: strip all Mesa/EGL/GL/drm/gbm libraries.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

APPIMAGE_DIR="$REPO_ROOT/target/release/bundle/appimage"
APPIMAGE=$(ls "$APPIMAGE_DIR"/*.AppImage 2>/dev/null | head -1)

if [ -z "$APPIMAGE" ]; then
  echo "::error::No AppImage found in $APPIMAGE_DIR"
  exit 1
fi

echo "Patching: $(basename "$APPIMAGE")"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cd "$WORKDIR"
"$APPIMAGE" --appimage-extract > /dev/null 2>&1

if [ ! -d squashfs-root ]; then
  ls -la
  echo "::error::AppImage extraction failed"
  exit 1
fi

echo "Files in extracted AppImage:"
find squashfs-root -type f | wc -l

# Search for Mesa/EGL/GL/drm/gbm anywhere in the tree
echo "Searching for Mesa/EGL libraries..."
find squashfs-root -type f,l \( \
  -name 'libEGL*' -o \
  -name 'libGL*' -o \
  -name 'libdrm*' -o \
  -name 'libgbm*' -o \
  -name 'libglapi*' \
\) -print 2>/dev/null | tee /dev/stderr | wc -l | xargs -I{} echo "Mesa/EGL files found: {}"

# Delete them
find squashfs-root -type f,l \( \
  -name 'libEGL*' -o \
  -name 'libGL*' -o \
  -name 'libdrm*' -o \
  -name 'libgbm*' -o \
  -name 'libglapi*' \
\) -delete 2>/dev/null || true

# Verify deletion
REMAINING=$(find squashfs-root -type f,l \( \
  -name 'libEGL*' -o \
  -name 'libGL*' -o \
  -name 'libdrm*' -o \
  -name 'libgbm*' -o \
  -name 'libglapi*' \
\) 2>/dev/null | wc -l)

if [ "$REMAINING" -eq 0 ]; then
  echo "All Mesa/EGL library files removed successfully."
else
  echo "::warning::$REMAINING Mesa/EGL library files could NOT be deleted"
  find squashfs-root -type f,l \( \
    -name 'libEGL*' -o \
    -name 'libGL*' -o \
    -name 'libdrm*' -o \
    -name 'libgbm*' -o \
    -name 'libglapi*' \) -print
fi

# Also inject env vars into AppRun (belt+suspenders)
# This ensures WebKit sees the vars even if EGL init happens before the binary starts
APPRUN="squashfs-root/AppRun"
if [ -f "$APPRUN" ] && ! grep -q 'PATCHED_BY_EGL_FIX' "$APPRUN"; then
  sed -i '1a\
# PATCHED_BY_EGL_FIX\
export WEBKIT_DISABLE_DMABUF_RENDERER=1\
export WEBKIT_DISABLE_COMPOSITING_MODE=1
' "$APPRUN"
  echo "AppRun patched with WebKit compat env vars"
fi

# Repackage with appimagetool
APPIMAGETOOL=$(ls "$APPIMAGE_DIR"/appimagetool* 2>/dev/null | head -1 || true)
if [ -z "$APPIMAGETOOL" ]; then
  APPIMAGETOOL=$(find ~/.cache/tauri -name 'appimagetool*' -type f 2>/dev/null | head -1 || true)
fi
if [ -z "$APPIMAGETOOL" ] || [ ! -f "$APPIMAGETOOL" ]; then
  echo "Downloading appimagetool..."
  APPIMAGETOOL="$WORKDIR/appimagetool"
  curl -sL "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage" -o "$APPIMAGETOOL"
  chmod +x "$APPIMAGETOOL"
fi

CMD="$APPIMAGETOOL"
file "$CMD" 2>/dev/null | grep -qi 'AppImage' && CMD="$CMD --appimage-extract-and-run"

ARCH=x86_64 $CMD --no-appstream squashfs-root "$APPIMAGE" 2>&1
echo "Done: $(ls -lh "$APPIMAGE")"
