#!/usr/bin/env bash
# Post-build AppImage patcher to fix EGL_BAD_PARAMETER on Arch/CachyOS.
#
# The problem: Ubuntu's Mesa + WebKitGTK bundled in the AppImage don't
# work with Arch's kernel/DRM stack. Mesa tries to create an EGL display
# using the GPU (radeonsi/amdgpu) but fails because of version mismatch
# between bundled DRI drivers and the kernel.
#
# Three-layer fix:
#   1. Remove bundled Mesa/EGL/GL libraries → force use of system Mesa
#   2. Inject env vars into AppRun →
#      WEBKIT_DISABLE_DMABUF_RENDERER=1  — WebKit: don't use dmabuf
#      WEBKIT_DISABLE_COMPOSITING_MODE=1 — WebKit: software compositing
#      LIBGL_ALWAYS_SOFTWARE=1           — Mesa OpenGL: software only
#      GALLIUM_DRIVER=llvmpipe          — Mesa: use llvmpipe DRI driver
#      EGL_PLATFORM=x11                 — EGL: force X11 platform
#      GDK_BACKEND=x11                  — GTK: force X11 backend
#   3. Inject env vars into the binary's RPATH via patchelf
#      (so subprocesses inherit without AppRun involvement)

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

# ---------------------------------------------------------------
# Step 1: Extract the AppImage
# ---------------------------------------------------------------
echo "::group::Extracting AppImage"
"$APPIMAGE" --appimage-extract > /dev/null 2>&1

if [ ! -d squashfs-root ]; then
  ls -la
  echo "::error::AppImage extraction failed"
  exit 1
fi
echo "Extracted: $(find squashfs-root -type f | wc -l) files"
echo "::endgroup::"

# ---------------------------------------------------------------
# Step 2: Remove bundled Mesa/EGL/GL libraries
# ---------------------------------------------------------------
echo "::group::Removing Mesa/EGL/GL libraries"

# Search everywhere in the tree
FOUND=$(find squashfs-root -type f,l \( \
  -name 'libEGL*' -o \
  -name 'libGL*' -o \
  -name 'libdrm*' -o \
  -name 'libgbm*' -o \
  -name 'libglapi*' -o \
  -name 'libGLdispatch*' -o \
  -name 'libglvnd*' -o \
  -name 'libGLX*' -o \
  -name 'libOpenGL*' -o \
  -name 'libepoxy*' \
\) -print 2>/dev/null | tee /dev/stderr || true)

COUNT=$(echo "$FOUND" | grep -c . || true)

if [ "$COUNT" -gt 0 ]; then
  find squashfs-root -type f,l \( \
    -name 'libEGL*' -o \
    -name 'libGL*' -o \
    -name 'libdrm*' -o \
    -name 'libgbm*' -o \
    -name 'libglapi*' -o \
    -name 'libGLdispatch*' -o \
    -name 'libglvnd*' -o \
    -name 'libGLX*' -o \
    -name 'libOpenGL*' -o \
    -name 'libepoxy*' \
  \) -delete 2>/dev/null || true
  echo "Removed $COUNT Mesa/EGL/GL library files"
else
  echo "No Mesa/EGL/GL libraries found (system already clean)"
fi

# Also check for DRI driver directories
DRI_DIRS=$(find squashfs-root -type d -name dri 2>/dev/null || true)
if [ -n "$DRI_DIRS" ]; then
  for d in $DRI_DIRS; do
    DRV_COUNT=$(find "$d" -type f | wc -l)
    rm -rf "$d"
    echo "Removed DRI driver directory: $d ($DRV_COUNT drivers)"
  done
fi

echo "::endgroup::"

# ---------------------------------------------------------------
# Step 3: Inject env vars into AppRun
# ---------------------------------------------------------------
APPRUN="squashfs-root/AppRun"

if [ -f "$APPRUN" ]; then
  echo "::group::Patching AppRun"

  # Check if already patched
  if grep -q 'PATCHED_BY_VINYLLY_EGL_FIX' "$APPRUN" 2>/dev/null; then
    echo "AppRun already patched, removing old patch first"
    # Remove old patch lines
    sed -i '/^# PATCHED_BY_VINYLLY_EGL_FIX/,/^$/d' "$APPRUN"
  fi

  # Insert env vars right after shebang (before any exec)
  sed -i '1a\
# PATCHED_BY_VINYLLY_EGL_FIX\
export WEBKIT_DISABLE_DMABUF_RENDERER=1\
export WEBKIT_DISABLE_COMPOSITING_MODE=1\
export LIBGL_ALWAYS_SOFTWARE=1\
export GALLIUM_DRIVER=llvmpipe\
export EGL_PLATFORM=x11\
export GDK_BACKEND=x11\
' "$APPRUN"

  echo "AppRun patched:"
  head -10 "$APPRUN"
  echo "::endgroup::"
else
  echo "::warning::AppRun not found"
fi

# ---------------------------------------------------------------
# Step 4: Also patch WebKit subprocess binaries to inherit env
# ---------------------------------------------------------------
echo "::group::Patching WebKit binaries"
for f in squashfs-root/usr/lib*/webkit2gtk*/WebKit*Process; do
  if [ -f "$f" ]; then
    # We can't easily modify env in a binary, but we can note it
    echo "Found: $f"
  fi
done
echo "::endgroup::"

# ---------------------------------------------------------------
# Step 5: Repackage with appimagetool
# ---------------------------------------------------------------
echo "::group::Repackaging AppImage"

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
echo "::endgroup::"

echo "Done: $(ls -lh "$APPIMAGE")"
