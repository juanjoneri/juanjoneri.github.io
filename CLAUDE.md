# juanjoneri.github.io — instructions for Claude

This repo is the **public hub**. It holds rules, shared style, and tooling. Private data never lands here.
The human-readable manual is `index.html` (served at https://juanjoneri.github.io); keep it in sync with this file.

## Layout
- `index.html` — the manual (rules, registration steps, page contract, style guide). Its "sites" table is generated at deploy time from `registry.json` + `sites.lock.json` (placeholder `<!-- SITES -->`).
- `assets/style.css` — shared tokens and components. `assets/unlock.html` — StatiCrypt template. `assets/favicon.svg`.
- `registry.json` — allowlist of private sites (`slug` = private repo name, `title` = label on the landing page). Only these are deployed and listed.
- `sites.lock.json` — last publish per site, written by private repos; pushing it triggers deploy.
- `.github/workflows/publish.yml` — reusable workflow private repos call (build → encrypt → push `site/<slug>`).
- `.github/workflows/deploy.yml` + `.github/scripts/assemble.sh` — builds Pages from master + `site/*` branches.
- `archive/` — 2018 portfolio. Leave as is.

## Hard rules
1. Never commit plaintext private content, or anything derived from private data, to this repo. Encrypted output goes only to `site/<slug>` branches, and only via publish.yml.
2. Never print, log, or echo secrets (`STATICRYPT_PASSWORD`, `HUB_DEPLOY_KEY`) or page content in workflows here or in private repos.
3. Pin every third-party Action to a full commit SHA with the version in a comment.
4. Site slugs and titles are public (registry, landing page, branch names). Never put sensitive details in a repo name or `title`.

## Building a page in a private repo
- Build writes plain HTML to `dist/`; `dist/index.html` required; subpages are any `dist/**/*.html`; links are relative.
- Only `.html` files in `dist/` (inline CSS/JS/SVG/data-URI images). Pages may link `/assets/style.css` and `/assets/favicon.svg`.
- Include `<meta name="robots" content="noindex, nofollow">`.
- Show aggregates only: no account numbers, card digits, addresses, emails, or phone numbers. People may appear by first name or nickname only (never full names).
- Build-time secrets (API tokens) go in the private repo's secrets and reach the build via the `BUILD_ENV` secret of publish.yml (KEY=VALUE lines); they are exported to the build step only.
- Time-window cadence: GitHub cron is UTC-only, so schedule both DST variants of each hour and gate on local time in a first job (see airtable-debts/.github/workflows/site.yml).
- Follow the style guide in `index.html` (monospace, 13px, `.label`, `.kpi`, `table`/`td.num`, status icons, series colours `--s1…--s7`).
