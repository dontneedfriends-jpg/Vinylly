#!/usr/bin/env bash
# Post-build AppImage patcher: strip conflicting Mesa/EGL libraries
# so the AppImage uses the system's Mesa at runtime.
#
# Why: AppImage bundles Mesa libraries from the CI build environment
# (Ubuntu). When run on Arch/CachyOS, these libraries cause
# "Could not create default EGL display: EGL_BAD_PARAMETER" because
# the bundled Mesa is incompatible with the system's kernel/DRM/KMS.
#
# Removing them lets the dynamic linker fall through to /usr/lib
# where the correct Mesa for the target system lives.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Locate the AppImage
APPIMAGE_DIR="$REPO_ROOT/target/release/bundle/appimage"
APPIMAGE=$(ls "$APPIMAGE_DIR"/*.AppImage 2>/dev/null | head -1)

if [ -z "$APPIMAGE" ]; then
  echo "ERROR: No AppImage found in $APPIMAGE_DIR"
  echo "Make sure 'tauri build' ran successfully first."
  exit 1
fi

echo "Patching: $(basename "$APPIMAGE")"

# Create temp working directory
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Extract the AppImage
cd "$WORKDIR"
"$APPIMAGE" --appimage-extract > /dev/null 2>&1

EXTRACT_DIR="$WORKDIR/squashfs-root"
LIBDIR="$EXTRACT_DIR/usr/lib"

if [ ! -d "$LIBDIR" ]; then
  echo "ERROR: Expected extracted files at $LIBDIR"
  exit 1
fi

# Count before
BEFORE=$(find "$LIBDIR" \( -name 'libEGL*' -o -name 'libGL*' -o -name 'libdrm*' -o -name 'libgbm*' -o -name 'libglapi*' \) | wc -l)

# Remove conflicting Mesa/EGL/DRM libraries
find "$LIBDIR" \( \
  -name 'libEGL*' -o \
  -name 'libGL*.so*' -o \
  -name 'libdrm*.so*' -o \
  -name 'libgbm*.so*' -o \
  -name 'libglapi*' \
\) -delete -print 2>/dev/null || true

AFTER=$(find "$LIBDIR" \( -name 'libEGL*' -o -name 'libGL*' -o -name 'libdrm*' -o -name 'libgbm*' -o -name 'libglapi*' \) | wc -l)
REMOVED=$((BEFORE - AFTER))
echo "Removed $REMOVED conflicting Mesa/EGL library files"

# Repackage with appimagetool
# Repackage with appimagetool
APPIMAGETOOL=$(ls "$REPO_ROOT"/target/release/bundle/appimage/appimagetool* 2>/dev/null | head -1 || true)

if [ -z "$APPIMAGETOOL" ]; then
  APPIMAGETOOL=$(find ~/.cache/tauri -name 'appimagetool*' -type f 2>/dev/null | head -1 || true)
fi

if [ -z "$APPIMAGETOOL" ] || [ ! -f "$APPIMAGETOOL" ]; then
  echo "appimagetool not found in cache, downloading..."
  APPIMAGETOOL="$WORKDIR/appimagetool"
  curl -sL "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage" -o "$APPIMAGETOOL"
  chmod +x "$APPIMAGETOOL"
fi

# Run appimagetool without FUSE (extract-and-run) and skip appstream check
APPIMAGETOOL_CMD="$APPIMAGETOOL"
if [ -x "$APPIMAGETOOL" ] && file "$APPIMAGETOOL" | grep -qi 'AppImage'; then
  APPIMAGETOOL_CMD="$APPIMAGETOOL --appimage-extract-and-run"
fi

ARCH=x86_64 $APPIMAGETOOL_CMD --no-appstream "$EXTRACT_DIR" "$APPIMAGE" 2>&1 | tail -1
echo "Patched AppImage: $APPIMAGE"
echo "Done."
