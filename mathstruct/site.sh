#!/usr/bin/env bash
# Build one MathStruct site with this Quartz checkout.
#
#   mathstruct/site.sh SITE_DIR CONTENT_DIR [OUT_DIR] [--serve]
#
# SITE_DIR holds the site's own files:
#   quartz.config.ts, quartz.layout.ts   the site's configuration (usually a call to the preset)
#   .tikz-cache/                         rendered TikZ diagrams, committed (created if missing)
#   static/                              optional: files that replace quartz/static/ (icon.png, ...)
# CONTENT_DIR is the Obsidian vault. OUT_DIR defaults to SITE_DIR/public.
# --serve builds, then serves on http://localhost:8080 and rebuilds when a note changes.
#
# Sites do not call this directly but through their own site/build.sh, which first fetches
# this repository (see README.md).
set -euo pipefail

ENGINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="$(cd "${1:?usage: site.sh SITE_DIR CONTENT_DIR [OUT_DIR] [--serve]}" && pwd)"
CONTENT="$(cd "${2:?usage: site.sh SITE_DIR CONTENT_DIR [OUT_DIR] [--serve]}" && pwd)"
shift 2
OUT="$SITE/public"
SERVE=0
for arg in "$@"; do
  case "$arg" in
    --serve) SERVE=1 ;;
    *) mkdir -p "$arg" && OUT="$(cd "$arg" && pwd)" ;;
  esac
done

# --- dependencies, reinstalled whenever the lockfile changes -------------------------
LOCKHASH="$(sha1sum "$ENGINE/package-lock.json" | cut -d' ' -f1)"
if [[ "$(cat "$ENGINE/node_modules/.mathstruct-lock" 2>/dev/null)" != "$LOCKHASH" ]]; then
  echo ">> npm ci"
  # (esbuild, sharp and @parcel/watcher get their native binaries from optional dependencies,
  # so npm >= 12 blocking install scripts by default does no harm)
  (cd "$ENGINE" && npm ci --no-audit --no-fund)
  echo "$LOCKHASH" > "$ENGINE/node_modules/.mathstruct-lock"
fi

# --- the site's files over the engine's ------------------------------------------------
# The checkout's own config, layout and static files are put back afterwards, so a checkout
# used for developing the engine stays clean.
restore() {
  git -C "$ENGINE" checkout -q -- quartz.config.ts quartz.layout.ts quartz/static 2>/dev/null || true
  git -C "$ENGINE" clean -q -f -- quartz/static 2>/dev/null || true
}
trap restore EXIT
cp "$SITE/quartz.config.ts" "$ENGINE/quartz.config.ts"
cp "$SITE/quartz.layout.ts" "$ENGINE/quartz.layout.ts"
if [[ -d "$SITE/static" ]]; then cp -r "$SITE/static/." "$ENGINE/quartz/static/"; fi
mkdir -p "$SITE/.tikz-cache"
rm -rf "$ENGINE/.tikz-cache" && ln -s "$SITE/.tikz-cache" "$ENGINE/.tikz-cache"

# --- build ---------------------------------------------------------------------------
cd "$ENGINE"
if [[ $SERVE -eq 1 ]]; then
  npx quartz build --serve -d "$CONTENT" -o "$OUT"
else
  npx quartz build -d "$CONTENT" -o "$OUT"
  # KaTeX renders a bad formula as red text rather than failing; say where
  if grep -rlq 'katex-error' "$OUT" --include='*.html'; then
    echo "!! KaTeX parse errors in:"
    grep -rl 'katex-error' "$OUT" --include='*.html' | sed "s#^$OUT/#   #"
  fi
fi
