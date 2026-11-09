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
| shared | May reference public `/assets/style.css`, `/assets/favicon.svg`, `/assets/status.js` and `/assets/ui.js`. No third-party scripts. The iPhone home-screen icon is `/apple-touch-icon.png` at the root, which iOS picks up for every page. |
| status | Every page includes the status block (`STANDARD.md` §7.3); job health shows inside the encrypted page only. |
| title | The repo name in title case, everywhere: `airtable-debts` → **Airtable Debts** (landing page, unlock screen, browser tab, page `<title>` and heading). Subpages: `Airtable Debts · Details`. |
| head | `<meta name="robots" content="noindex, nofollow">` |
| unlock | One password per site. "Remember for 30 days" covers all subpages of that site. |
| size | Keep each page under ~2 MB; it is decrypted in the browser. |

## Style

Dark only, compact, touch first. Monospace throughout, colour only to mean something, pills for anything tappable,
emoji sparingly (tabs, the hub button, warnings; not in rows or numbers). Link `/assets/style.css`; add
`<script src="/assets/ui.js"></script>` for behaviour. Pages keep working without JavaScript. Motion is short
(120–200 ms) and switches off under Reduce Motion.

**Type:** `Menlo, Consolas, "Courier New", monospace`, 13px / 1.5; titles 15px bold; `.label` 11px uppercase with a
blue `▍`; numbers right-aligned with `tabular-nums` (`td.num`), k/M abbreviations.

**Colour tokens** (`assets/style.css`)

| token | value | use |
|---|---|---|
| `--bg` / `--surface` / `--raise` | `#0e0e0d` / `#181817` / `#222220` | page / pills, boxes / pressed |
| `--fg` / `--text` / `--muted` / `--line` | `#f2f1ed` / `#cfcdc7` / `#8a8984` / `#2a2a28` | numbers, headings / body / secondary / rules |
| `--accent` / `--good` / `--warn` / `--bad` | `#5b9ae6` / `#3fb950` / `#d4a72c` / `#e8687d` | links / positive / attention / negative |
| `--s1` … `--s7` | `#5b9ae6 #e8925a #a888e8 #3cbcbc #e0609a #4cc27a #d4a72c` | chart series, in order |

**Components**

```html
<!-- top bar: back to all sites, title, status (STANDARD.md §7.3). No reload button: pull to refresh does it. -->
<div class="topbar"><a class="btn back" href="/" aria-label="all sites">←<span class="e">🏠</span></a><h1>Airtable Debts</h1>
  <div data-site-status="airtable-debts"></div></div>

<!-- tabs: one scrolling row; swipe between panels; the open tab is kept in the URL (#market) -->
<div class="pill-row" data-tabs="main"><button class="btn" data-tab="market"><span class="e">📈</span>Market</button> …</div>
<section data-panel="market">…</section>

<!-- sticky header: wrap the top bar and the tabs so both stay on screen (a hairline appears once content scrolls under) -->
<header class="ui-head"><div class="topbar">…</div><div class="pill-row" data-tabs="main">…</div></header>

<!-- values -->
<div class="pills"><span class="chip good">owed <b>$4,135</b></span><span class="chip warn"><span class="e">⚠️</span><b>3</b> to review</span></div>

<!-- single choice (fires a `choice` event), expand all -->
<div class="pill-row" data-choice="range"><button class="btn on" data-value="1y">1y</button> … <span class="spacer"></span>
  <button class="btn" data-expand-all="#people">expand all</button></div>

<!-- expandable rows -->
<div id="people"><details class="disclosure"><summary>Robin <span class="muted">12</span><span class="n good">+$1,694</span></summary>
  <div class="in">…</div></details></div>

<!-- chart scrubbing: drag across to read values; tap to pin; vertical scrolling still works -->
<svg id="sp" viewBox="0 0 300 46" data-scrub='[[0,30,"Mon 6,780"],[100,22,"Tue 6,795"]]'>…</svg><div data-scrub-label="sp"></div>
```
Also: `.scroll-x` (sideways-scrolling table wrapper), `.meter > i` (progress bar), `.tag`, and the older `.kpis` /
`.kpi` / `.bar`, which still work.

Pills are 32px tall with a 44px tap area. Text is centred on its capital letters (`text-box`, iOS 18.2+; padded
fallback for older iOS), and `.e` aligns emoji to it. Measured within 1px with Menlo's metrics.

## Operations

| | |
|---|---|
| cadence | Each private repo's `schedule` cron. Manual: Actions → site → Run workflow. Cron is UTC: for local-time windows, schedule both DST hours and gate on `TZ=America/Los_Angeles date +%H` in a first job. |
| build secrets | API tokens live in the private repo's secrets and are passed as `BUILD_ENV` lines; only the build step sees them. Use read-only tokens scoped to one base or resource. |
| go-live delay | Each site push triggers the deploy (a few minutes). A 10-minute schedule is a fallback. To publish now: this repo → Actions → deploy → Run workflow. |
| hub changes | `master` is protected: only Juan pushes it; everyone else opens a pull request. After changing `publish.yml`, `.github/scripts/encrypt.sh` / `push.sh`, `.github/staticrypt` or `assets/unlock.html`, bump the pinned commit (`uses: …@<sha>` and `hub_ref`) in every private repo. |
| new deploy key | Generate a new key, replace the public half under Deploy keys and the private half in the repo's `HUB_DEPLOY_KEY`, run its workflow, then put the new "signing key" from the log in `registry.json`. |
| site rejected | It is not deployed: the landing page lists it as "not published" ⚠️ and the deploy run fails (GitHub emails you). The build job's log says why: "bad signature or manifest" (wrong key, or files changed after signing), "unsigned" (no key in the registry yet), or non-HTML / unencrypted files. |
| new password | Replace the repo secret, re-run its workflow, update the password manager. The old one stops working. |
| unregister | Remove it from `registry.json`; delete the branch `site/<repo>` and its deploy key. |
| failed publish | Check the private repo's Actions log (private). Deploy errors are in this repo's Actions log; they never contain page content. |

## Archive

`archive/` is the 2018 portfolio, kept in the repo for posterity. It is **not deployed** and not linked from anywhere.
