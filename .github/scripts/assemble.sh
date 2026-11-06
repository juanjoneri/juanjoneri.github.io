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
ROWS=""
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
  title=$(echo "$slug" | sed -E 's/[-_.]+/ /g; s/\b(.)/\u\1/g')   # repo name in title case: airtable-debts → Airtable Debts
  ts=$(jq -r --arg s "$slug" '.[$s].published_at // empty' sites.lock.json 2>/dev/null || true)
  when=$([ -n "$ts" ] && TZ=America/Los_Angeles date -d "$ts" '+%b %-d, %-I:%M %p' || echo "—")
  ROWS+="    <tr><td>🔒 <a href=\"/p/$slug/\">$title</a></td><td class=\"hide-sm muted\">/p/$slug/</td><td class=\"num muted\">$when</td></tr>"$'\n'
done

# Fill the landing page's sites table.
[ -n "$ROWS" ] || ROWS='    <tr><td colspan="3" class="muted">no sites published yet</td></tr>'$'\n'
python3 - "$OUT/index.html" "$ROWS" <<'PY'
import sys
p, rows = sys.argv[1], sys.argv[2]
s = open(p).read()
open(p, "w").write(s.replace("<!-- SITES -->", rows.rstrip("\n")))
PY
