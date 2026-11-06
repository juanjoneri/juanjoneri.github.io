# juanjoneri.github.io — instructions for Claude

This repo is the **public hub**. It holds rules, shared style, and tooling. Private data never lands here.
The human-readable manual is `index.html` (served at https://juanjoneri.github.io); keep it in sync with this file.

## Layout
- `index.html` — the manual (rules, registration steps, page contract, style guide). Does **not** list private sites.
- `assets/style.css` — shared tokens and components. `assets/unlock.html` — StatiCrypt template. `assets/favicon.svg`.
- `registry.json` — allowlist of private sites (`slug` = private repo name). Only these are deployed.
- `sites.lock.json` — last publish per site, written by private repos; pushing it triggers deploy.
- `.github/workflows/publish.yml` — reusable workflow private repos call (build → encrypt → push `site/<slug>`).
- `.github/workflows/deploy.yml` + `.github/scripts/assemble.sh` — builds Pages from master + `site/*` branches.
- `archive/` — 2018 portfolio. Leave as is.

## Hard rules
1. Never commit plaintext private content, or anything derived from private data, to this repo. Encrypted output goes only to `site/<slug>` branches, and only via publish.yml.
2. Never print, log, or echo secrets (`STATICRYPT_PASSWORD`, `HUB_DEPLOY_KEY`) or page content in workflows here or in private repos.
3. Pin every third-party Action to a full commit SHA with the version in a comment.
4. Do not list private sites on public pages.

## Building a page in a private repo
- Build writes plain HTML to `dist/`; `dist/index.html` required; subpages are any `dist/**/*.html`; links are relative.
- Only `.html` files in `dist/` (inline CSS/JS/SVG/data-URI images). Pages may link `/assets/style.css` and `/assets/favicon.svg`.
- Include `<meta name="robots" content="noindex, nofollow">`.
- Show aggregates only: no account numbers, card digits, addresses, emails, phone numbers, or third parties' names.
- Follow the style guide in `index.html` (monospace, 13px, `.label`, `.kpi`, `table`/`td.num`, status icons, series colours `--s1…--s7`).
