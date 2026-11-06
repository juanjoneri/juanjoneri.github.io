#!/usr/bin/env bash
# Assemble the Pages artifact: public files from master + one encrypted site per registry entry.
set -euo pipefail
OUT=_site
MARKER='id="staticrypt-form"'
rm -rf "$OUT" && mkdir -p "$OUT"

# Public files = everything tracked on master, minus repo plumbing.
git archive HEAD | tar -x -C "$OUT"
# archive/ (2018 portfolio) is kept in the repo for posterity but not deployed.
rm -rf "$OUT/.github" "$OUT/p" "$OUT/archive" "$OUT/CLAUDE.md" "$OUT/MANUAL.md" "$OUT/README.md" "$OUT/registry.json" "$OUT/.gitignore" "$OUT/.gitattributes"
touch "$OUT/.nojekyll"

# Registered sites. Branches not in registry.json are never published.
REQUIRE_SIG=$(jq -r '.require_signatures // false' registry.json)
ROWS=""
for slug in $(jq -r '.sites[].slug' registry.json); do
  if [[ ! "$slug" =~ ^[A-Za-z0-9._-]+$ ]]; then echo "::error::invalid slug '$slug'"; continue; fi
  if ! git fetch -q --depth 1 origin "+refs/heads/site/$slug:refs/remotes/origin/site/$slug" 2>/dev/null; then
    echo "::warning::$slug is registered but has never been published (no site/$slug branch)"; continue
  fi
  tmp=$(mktemp -d)
  git archive "origin/site/$slug" | tar -x -C "$tmp"
  # Signature: _site.manifest must be signed by the key registered for this slug, and match the files exactly.
  key=$(jq -r --arg s "$slug" '.sites[] | select(.slug == $s) | .key // empty' registry.json)
  if [ -f "$tmp/_site.manifest" ] && [ -f "$tmp/_site.manifest.sig" ] && [ -n "$key" ]; then
    printf '%s namespaces="juanjoneri-site" %s\n' "$slug" "$key" > "$tmp.signers"
    if ! ssh-keygen -Y verify -q -f "$tmp.signers" -I "$slug" -n juanjoneri-site -s "$tmp/_site.manifest.sig" < "$tmp/_site.manifest" >/dev/null 2>&1 \
       || [ "$(head -1 "$tmp/_site.manifest")" != "slug: $slug" ] \
       || ! (cd "$tmp" && tail -n +2 _site.manifest | sha256sum -c --strict --quiet) \
       || [ "$(tail -n +2 "$tmp/_site.manifest" | sed 's/^[0-9a-f]*  //' | LC_ALL=C sort)" != "$(cd "$tmp" && find . -type f -name '*.html' | LC_ALL=C sort)" ]; then
      echo "::error::$slug rejected — bad signature or manifest"; continue
    fi
    signed=" signed"
  elif [ "$REQUIRE_SIG" = "true" ]; then
    echo "::error::$slug rejected — unsigned or no key in registry.json"; continue
  else
    echo "::warning::$slug is not signed (or has no key in registry.json)"; signed=""
  fi
  rm -f "$tmp/_site.manifest" "$tmp/_site.manifest.sig"
  rm -f "$tmp/.github/workflows/kick.yml" && rmdir "$tmp/.github/workflows" "$tmp/.github" 2>/dev/null || true   # deploy trigger, not content
  # Only regular .html files and directories are allowed (no symlinks, devices, or other file types).
  non_html=$(cd "$tmp" && find . ! -type d ! \( -type f -name '*.html' \))
  html=$(cd "$tmp" && find . -type f -name '*.html')
  plain=""
  for f in $html; do grep -q "$MARKER" "$tmp/$f" || plain="$plain $f"; done
  if [ -z "$html" ] || [ -n "$non_html" ] || [ -n "$plain" ]; then
    echo "::error::$slug rejected — non-HTML files: [${non_html//$'\n'/ }] unencrypted HTML: [$plain]"; continue
  fi
  mkdir -p "$OUT/p/$slug" && cp -r "$tmp"/. "$OUT/p/$slug/"
  echo "✓ /p/$slug ($(echo "$html" | wc -l) page(s))$signed"
  title=$(echo "$slug" | sed -E 's/[-_.]+/ /g; s/\b(.)/\u\1/g')   # repo name in title case: airtable-debts → Airtable Debts
  ts=$(git log -1 --format=%cI "origin/site/$slug")
  when=$([ -n "$ts" ] && TZ=America/Los_Angeles date -d "$ts" '+%b %-d, %-I:%M %p' || echo "—")
  ROWS+="    <tr><td>🔒 <a href=\"/p/$slug/\">$title</a></td><td class=\"hide-sm muted\">/p/$slug/</td><td class=\"num muted\">$when</td></tr>"$'\n'
done

# Deploy state written by deploy.yml (master + site branch SHAs); published so the next run can skip if unchanged.
[ -f .deploy-state ] && cp .deploy-state "$OUT/deploy-state.txt"

# Fill the landing page's sites table.
[ -n "$ROWS" ] || ROWS='    <tr><td colspan="3" class="muted">no sites published yet</td></tr>'$'\n'
python3 - "$OUT/index.html" "$ROWS" <<'PY'
import sys
p, rows = sys.argv[1], sys.argv[2]
s = open(p).read()
open(p, "w").write(s.replace("<!-- SITES -->", rows.rstrip("\n")))
PY
