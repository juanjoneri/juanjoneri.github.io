# juanjoneri.github.io manual

How pages on https://juanjoneri.github.io are made. Private repos hold the data and the logic; this repo holds the
rules, the shared style, the publishing tooling, and encrypted output only (on `site/*` branches). Every private page
lives at `/p/<private-repo-name>/`. The landing page only lists the sites; everything else is documented here.
Rules for agents: [`CLAUDE.md`](CLAUDE.md). How each private project is structured, keeps its state and reports its
health: [`STANDARD.md`](STANDARD.md).

## Flow

```
private repo (e.g. net-worth)                 juanjoneri.github.io (public)
─────────────────────────────                 ─────────────────────────────
data + build script
   │ build             → dist/**/*.html  (plaintext, never leaves the runner)
   │ encrypt (staticrypt, per-site password)
   │ sign (deploy key)
   └ force-push        ─────────────────▶  branch site/net-worth   (latest copy only)
                                              │ deploy workflow (triggered by the push)
                                              ▼  only slugs in registry.json, signature checked
                                           /p/net-worth/…  (GitHub Pages)
```

Nothing encrypted is committed to `master`, so changing a password fully retires the old one.

## Rules

1. Raw data, credentials and business logic stay in the private repo.
2. Pages show **aggregates**: totals, trends, categories. No account numbers, card digits, addresses, emails or phone
   numbers. People by first name or nickname only.
3. Every private page is encrypted. Nothing private is ever committed to this repo in plaintext.
4. One password per site, stored in the password manager and as that repo's `STATICRYPT_PASSWORD` secret. 6+ random words.
5. Site names and paths are public (they are in `registry.json` and on the landing page), so pick repo names that
   reveal nothing on their own.

## Register a private repo

1. Generate a password in the password manager → private repo → **Settings → Secrets → Actions** → `STATICRYPT_PASSWORD`.
2. Make a deploy key on your machine:
   ```bash
   ssh-keygen -t ed25519 -N "" -C "<repo-name> -> hub" -f hub_key
   ```
   `hub_key.pub` → this repo → **Settings → Deploy keys** (allow write).
   `hub_key` → private repo secret `HUB_DEPLOY_KEY`. Then delete both files.
3. In the private repo, add a build script and `.github/workflows/site.yml`:
   ```yaml
   name: site
   on:
     push: { branches: [main] }
     workflow_dispatch:
     schedule: [{ cron: "17 9 * * 1" }]   # cadence
   jobs:
     publish:
       uses: juanjoneri/juanjoneri.github.io/.github/workflows/publish.yml@<sha>   # pin to a reviewed hub commit
       with:
         build: bash build.sh      # must write plain HTML into dist/
         hub_ref: <same sha>       # scripts, template and lockfile from the same commit
       secrets:
         STATICRYPT_PASSWORD: ${{ secrets.STATICRYPT_PASSWORD }}
         HUB_DEPLOY_KEY: ${{ secrets.HUB_DEPLOY_KEY }}
         BUILD_ENV: API_TOKEN=${{ secrets.API_TOKEN }}   # optional: secrets for the build step only
   ```
4. Push. The first publish prints the site's **signing key** in its push-job log
   ("signing key (public, for registry.json)").
5. Add `{ "slug": "<repo-name>", "repo": "juanjoneri/<repo-name>", "key": "ssh-ed25519 …" }` to `registry.json`
   (by pull request: `master` is protected). Until the key is registered the site is signed but not deployed. After
   that, every publish appears at `/p/<repo-name>/` within a few minutes, and the landing page lists it.

## Page contract

| | |
|---|---|
| entry | `dist/index.html` is required. |
| subpages | Any `dist/**/*.html`. `dist/q3/index.html` → `/p/<repo>/q3/`. Link with relative paths. |
| files | **Only .html.** Inline CSS, JS, SVG charts and images (data URIs). Anything else would be published unencrypted, so the build fails. |
| shared | May reference public `/assets/style.css`, `/assets/favicon.svg` and `/assets/status.js`. No third-party scripts. |
| status | Every page includes the status block (`STANDARD.md` §7.3); job health shows inside the encrypted page only. |
| title | The repo name in title case, everywhere: `airtable-debts` → **Airtable Debts** (landing page, unlock screen, browser tab, page `<title>` and heading). Subpages: `Airtable Debts · Details`. |
| head | `<meta name="robots" content="noindex, nofollow">` |
| unlock | One password per site. "Remember for 30 days" covers all subpages of that site. |
| size | Keep each page under ~2 MB; it is decrypted in the browser. |

## Style

Terminal-report look: one monospace font, small sizes, thin and dashed rules, colour only to mean something. Link
`/assets/style.css` to get all of this; it also handles dark mode.

**Type**

| | |
|---|---|
| font | `Menlo, Consolas, "Courier New", monospace` |
| body | 13px / 1.6 |
| title | 16px bold |
| label | 11px uppercase, +1px letter spacing, blue `▍` prefix (`.label`) |
| numbers | right-aligned, `tabular-nums` (`td.num`), k/M abbreviations (`21.2k`) |

**Colour tokens** (CSS variables in `assets/style.css`, light / dark)

| token | light | dark | use |
|---|---|---|---|
| `--bg` | `#fcfcfb` | `#111110` | page |
| `--surface` | `#ffffff` | `#181817` | boxes |
| `--fg` | `#0b0b0b` | `#f2f1ed` | headings, numbers |
| `--text` | `#383835` | `#cfcdc7` | body |
| `--muted` | `#8a8984` | `#8a8984` | secondary text |
| `--line` | `#e6e5e1` | `#2a2a28` | rules, borders |
| `--accent` | `#2a78d6` | `#5b9ae6` | links, buttons |
| `--good` | `#0a7f0a` | `#3fb950` | positive |
| `--warn` | `#9a6700` | `#d4a72c` | attention |
| `--bad` | `#d6455d` | `#e8687d` | negative |

Chart series, in order: `--s1` `#2a78d6`, `--s2` `#e07b39`, `--s3` `#8a5cd6`, `--s4` `#1f9a9a`, `--s5` `#c2185b`,
`--s6` `#2e9e5b`, `--s7` `#b8860b`.

**Components**

```html
<div class="bar"><span class="label">site name</span><a href="/">← hub</a></div>   <!-- top bar -->
<div class="kpis">                                                                   <!-- KPI row -->
  <div class="kpi"><div class="label">spent</div><div class="v">$3.9k</div><div class="d muted">this week</div></div>
  <div class="kpi"><div class="label">income</div><div class="v good">$48</div></div>   <!-- .good / .warn / .bad -->
</div>
<table>
  <tr><th>category</th><th class="num">week</th></tr>
  <tr><td>groceries</td><td class="num bad">+18%</td></tr>
</table>
<a class="btn" href="#">button</a> <span class="tag">tag</span>
```

Status words: ✅ ok · ⚠ needs attention · ⏳ pending / expiring · ✗ failed. Charts: inline SVG, 1–2px strokes, no
gridlines beyond a dashed baseline, series colours in order.

## Operations

| | |
|---|---|
| cadence | Each private repo's `schedule` cron. Manual: Actions → site → Run workflow. Cron is UTC: for local-time windows, schedule both DST hours and gate on `TZ=America/Los_Angeles date +%H` in a first job. |
| build secrets | API tokens live in the private repo's secrets and are passed as `BUILD_ENV` lines; only the build step sees them. Use read-only tokens scoped to one base or resource. |
| go-live delay | Each site push triggers the deploy (a few minutes). A 10-minute schedule is a fallback. To publish now: this repo → Actions → deploy → Run workflow. |
| hub changes | `master` is protected: only Juan pushes it; everyone else opens a pull request. After changing `publish.yml`, `.github/scripts/encrypt.sh` / `push.sh`, `.github/staticrypt` or `assets/unlock.html`, bump the pinned commit (`uses: …@<sha>` and `hub_ref`) in every private repo. |
| new deploy key | Generate a new key, replace the public half under Deploy keys and the private half in the repo's `HUB_DEPLOY_KEY`, run its workflow, then put the new "signing key" from the log in `registry.json`. |
| site rejected | The deploy log says why: "bad signature or manifest" (wrong key, or files changed after signing), "unsigned" (no key in the registry yet), or non-HTML / unencrypted files. |
| new password | Replace the repo secret, re-run its workflow, update the password manager. The old one stops working. |
| unregister | Remove it from `registry.json`; delete the branch `site/<repo>` and its deploy key. |
| failed publish | Check the private repo's Actions log (private). Deploy errors are in this repo's Actions log; they never contain page content. |

## Archive

`archive/` is the 2018 portfolio, kept in the repo for posterity. It is **not deployed** and not linked from anywhere.
