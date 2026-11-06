#!/usr/bin/env bash
# Assemble the Pages artifact: public files from master + one encrypted site per registry entry.
set -euo pipefail
OUT=_site
MARKER='id="staticrypt-form"'
rm -rf "$OUT" && mkdir -p "$OUT"

# Public files = everything tracked on master, minus repo plumbing.
git archive HEAD | tar -x -C "$OUT"
rm -rf "$OUT/.github" "$OUT/p" "$OUT/CLAUDE.md" "$OUT/README.md" "$OUT/registry.json" "$OUT/sites.lock.json" "$OUT/.gitignore" "$OUT/.gitattributes"
touch "$OUT/.nojekyll"

# Registered sites. Branches not in registry.json are never published.
for slug in $(jq -r '.sites[].slug' registry.json); do
  if [[ ! "$slug" =~ ^[A-Za-z0-9._-]+$ ]]; then echo "::error::invalid slug '$slug'"; continue; fi
  if ! git fetch -q --depth 1 origin "+refs/heads/site/$slug:refs/remotes/origin/site/$slug" 2>/dev/null; then
    echo "::warning::$slug is registered but has never been published (no site/$slug branch)"; continue
  fi
  tmp=$(mktemp -d)
  git archive "origin/site/$slug" | tar -x -C "$tmp"
  non_html=$(cd "$tmp" && find . -type f ! -name '*.html')
  html=$(cd "$tmp" && find . -type f -name '*.html')
  plain=""
  for f in $html; do grep -q "$MARKER" "$tmp/$f" || plain="$plain $f"; done
  if [ -z "$html" ] || [ -n "$non_html" ] || [ -n "$plain" ]; then
    echo "::error::$slug rejected — non-HTML files: [${non_html//$'\n'/ }] unencrypted HTML: [$plain]"; continue
  fi
  mkdir -p "$OUT/p/$slug" && cp -r "$tmp"/. "$OUT/p/$slug/"
  echo "✓ /p/$slug ($(echo "$html" | wc -l) page(s))"
done
