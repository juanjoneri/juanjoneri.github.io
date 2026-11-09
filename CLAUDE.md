# juanjoneri.github.io — instructions for Claude

This repo is the **public hub**. It holds rules, shared style, and tooling. Private data never lands here.
The human-readable manual is `MANUAL.md` (flow, registration, page contract, style guide, operations); keep it in sync with this
file. The served landing page (`index.html`) only lists the sites: no architecture or docs on the public site.

## Layout
- `index.html` — the landing page: only the list of sites, generated at deploy time from `registry.json` and the site branches (placeholder `<!-- SITES -->`).
- Only `index.html`, `404.html`, `apple-touch-icon.png` and `assets/` are deployed (allowlist in `assemble.sh`); docs, `kit/`, `registry.json` and everything else stay in the repo only.
- `MANUAL.md` — the manual (not deployed).
- `STANDARD.md` — the private-project standard every registered repo follows; `kit/sitekit.py` + `kit/template/` implement it (vendored into each project as `.kit/sitekit.py`).
- `assets/style.css` — shared tokens and components. `assets/unlock.html` — StatiCrypt template. `assets/favicon.svg`.
- `apple-touch-icon.png` — 180×180 home-screen icon (the favicon design, full-bleed). iOS ignores SVG favicons and requests `/apple-touch-icon.png` at the root for every page, so every site (encrypted pages included) gets it without a link tag.
- `registry.json` — allowlist of private sites: `slug` (= private repo name) and `key` (public half of that repo's deploy key, which signs its pages). `require_signatures: true` rejects any unsigned or wrongly signed site.
- `.github/workflows/publish.yml` — reusable workflow private repos call. Job `build` (build → encrypt; never sees the deploy key) and job `push` (signs a manifest of the files with the deploy key, force-pushes `site/<slug>`; runs no repo code). Private repos never write `master`.
- `.github/staticrypt/` — package.json + lockfile; installed with `npm ci --ignore-scripts`.
- `.github/workflows/deploy.yml` + `.github/scripts/assemble.sh` — builds Pages from master + `site/*` branches. Runs on push to master, when dispatched by a site branch's `kick.yml`, and every 10 min as a fallback (scheduled runs skip when nothing changed, via `deploy-state.txt` on the live site). Verifies each site's signature (`ssh-keygen -Y verify`, namespace `juanjoneri-site`).
- `archive/` — 2018 portfolio, kept for posterity. Not deployed and not linked; leave as is.

## Hard rules
1. Never commit plaintext private content, or anything derived from private data, to this repo. Encrypted output goes only to `site/<slug>` branches, and only via publish.yml.
2. Never print, log, or echo secrets (`STATICRYPT_PASSWORD`, `HUB_DEPLOY_KEY`) or page content in workflows here or in private repos.
3. Pin every third-party Action to a full commit SHA with the version in a comment.
4. Site slugs and titles are public (registry, landing page, branch names). Never put sensitive details in a repo name.
5. Private repos pin the hub to one reviewed commit: `uses: …/publish.yml@<sha>` **and** `hub_ref: <same sha>`. After changing hub tooling (`publish.yml`, `.github/scripts`, `.github/staticrypt`, `assets/unlock.html`), bump that SHA in every private repo's `site.yml`.
6. Nothing on this origin may load third-party scripts: every page here can read every site's "remember me" key. `archive/` is not deployed; if it ever is again, its scripts are already vendored under `archive/vendor/`.
7. Site branches may contain only regular `.html` files plus `_site.manifest` / `_site.manifest.sig`, the public status summary `status.json` (`{version: 2, slug, failed, ok_until}`; job details are embedded only inside the encrypted pages) and `.github/workflows/kick.yml` (written by push.sh; dispatches deploy.yml on master; stripped before publishing); `assemble.sh` rejects symlinks and anything else.
8. `master` is protected by a ruleset: only Juan pushes it. Claude sessions push a `claude/*` branch and open a PR. Registering a site = PR adding its `slug` and `key` to `registry.json`; the key is printed in the private repo's publish log ("signing key (public, for registry.json)").
9. Every registered project follows `STANDARD.md` v2 (one repo, `~/Code/<slug>`, `site.json`, `setup`/`doctor`/`run`, lossless SQLite state saved encrypted to its `state` branch with the shared key `SITES_DATA_KEY`, committed fake data + a `test` command, Mac jobs that update their code from `main` on every run, reporting inside the encrypted page). The goal: with the Mac on and nobody at it, every project is driven by pushing to its private repo. Changes to `kit/sitekit.py` must keep Python 3.9 compatibility and standard-library only.

## Building a page in a private repo
- Build writes plain HTML to `dist/`; `dist/index.html` required; subpages are any `dist/**/*.html`; links are relative.
- Only `.html` files in `dist/` (inline CSS/JS/SVG/data-URI images). Pages may link `/assets/style.css`, `/assets/favicon.svg`, `/assets/status.js` (the status block, STANDARD.md §7.3) and `/assets/ui.js` (shared behaviour: tabs, choice pills, expand all, chart scrubbing).
- Shared assets are served live from master (not pinned): every change must be backward compatible. New class names must not collide with the sites' own (check all four pages before merging); generic names get a `ui-` prefix.
- Include `<meta name="robots" content="noindex, nofollow">`.
- Page name = repo name in title case everywhere (`airtable-debts` → `Airtable Debts`): `<title>`, main heading, label. Subpages: `Airtable Debts · <Subpage>`. The landing page and unlock screen derive it automatically.
- Show aggregates only: no account numbers, card digits, addresses, emails, or phone numbers. People may appear by first name or nickname only (never full names).
- Build-time secrets (API tokens) go in the private repo's secrets and reach the build via the `BUILD_ENV` secret of publish.yml (KEY=VALUE lines); they are exported to the build step only.
- Time-window cadence: GitHub cron is UTC-only, so schedule both DST variants of each hour and gate on local time in a first job (see airtable-debts/.github/workflows/site.yml).
- Follow the style guide in `MANUAL.md` (monospace, 13px, `.label`, `.kpi`, `table`/`td.num`, status icons, series colours `--s1…--s7`).

## Operations notes
- Go-live: each `site/<slug>` push carries `kick.yml`, which dispatches `deploy.yml` on master (a few minutes end to end).
  GitHub's schedule (`3-59/10`) is only a fallback: it never fired on Nov 6 2026, even after Juan edited the cron. Publish now:
  `gh api -X POST repos/juanjoneri/juanjoneri.github.io/actions/workflows/deploy.yml/dispatches -f ref=master`.
- Only Juan edits the `cron` line in `deploy.yml` (GitHub runs a schedule as whoever last changed it).
- New site: its first publish prints "signing key (public, for registry.json)" in the push-job log; add it as `key` in
  `registry.json` (PR). Until then the site is not deployed (`require_signatures: true`).
- Deploy log lines to check: `✓ /p/<slug> (N page(s)) signed`; a rejected site is listed as "not published" ⚠️ on the landing page and fails the deploy run (email); errors name the reason (bad signature or manifest,
  unsigned, non-HTML, unencrypted).
- Repo settings that are part of the security model (Juan's, not visible to Claude): ruleset `protect master`
  (restrict updates/deletions, block force pushes, bypass = repository admin), workflow token read-only,
  `github-pages` environment limited to `master`.
