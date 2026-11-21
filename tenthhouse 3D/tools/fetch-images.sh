#!/usr/bin/env bash
# Downloads every photo the site uses from the current WordPress uploads into
# assets/photos/, and (if the tools are installed) makes WebP copies.
# Afterwards: set IMG_BASE = "assets/photos/" in tools/build.py and run
#   python3 tools/build.py
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="https://tenthhousestudio.com/wp-content/uploads/"
grep -ohE "${BASE}[^\" ]+\.(jpg|png)" ./*.html | sort -u | while read -r url; do
  rel="${url#"$BASE"}"
  out="assets/photos/${rel}"
  mkdir -p "$(dirname "$out")"
  [ -f "$out" ] || { echo "↓ $rel"; curl -fsSL "$url" -o "$out"; }
  if command -v cwebp >/dev/null && [[ "$out" == *.jpg ]] && [ ! -f "${out%.jpg}.webp" ]; then
    cwebp -quiet -q 80 "$out" -o "${out%.jpg}.webp"
  fi
done
echo "Done. Now set IMG_BASE = \"assets/photos/\" in tools/build.py and run: python3 tools/build.py"
