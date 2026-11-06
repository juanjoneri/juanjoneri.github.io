#!/usr/bin/env bash
# Encrypt every HTML file in $DIST into $OUT, preserving paths. Called by publish.yml.
set -euo pipefail
: "${SLUG:?}" "${DIST:?}" "${OUT:?}" "${TEMPLATE:?}" "${STATICRYPT_BIN:?}"
[ -n "${STATICRYPT_PASSWORD:-}" ] || { echo "::error::STATICRYPT_PASSWORD secret is missing in this repo"; exit 1; }
# Page title = repo name in title case (airtable-debts → Airtable Debts). Shown on the unlock screen and browser tab.
TITLE=$(echo "$SLUG" | sed -E 's/[-_.]+/ /g; s/\b(.)/\u\1/g')
# Salt: not secret, fixed per site (so "remember me" survives rebuilds), unique per site.
SALT=$(printf 'juanjoneri.github.io/p/%s' "$SLUG" | sha256sum | cut -c1-32)

[ -f "$DIST/index.html" ] || { echo "::error::$DIST/index.html missing — build must write plain HTML into $DIST/"; exit 1; }
non_html=$(cd "$DIST" && find . -type f ! -name '*.html')
if [ -n "$non_html" ]; then
  echo "::error::$DIST may only contain .html files (they are the only ones encrypted). Inline CSS/JS/images, or reference public /assets/*. Offending:"; echo "$non_html"; exit 1
fi

rm -rf "$OUT" && mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
cd "$DIST"
find . -type f -name '*.html' | sort | while read -r f; do
  d="$OUT/$(dirname "$f")"; mkdir -p "$d"
  "$STATICRYPT_BIN" "$f" -d "$d" -c false --short \
    --salt "$SALT" --remember 30 -t "$TEMPLATE" \
    --template-title "$TITLE" \
    --template-instructions "Private page. Password is in the password manager." \
    --template-placeholder "password" --template-button "unlock" \
    --template-remember "remember for 30 days" --template-error "wrong password" >/dev/null
  grep -q 'id="staticrypt-form"' "$d/$(basename "$f")" || { echo "::error::encryption failed for $f"; exit 1; }
  echo "🔒 $f"
done
