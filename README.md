# juanjoneri.github.io

Public hub for https://juanjoneri.github.io — the landing page is the manual for how pages here are built.

- Private repos build plain HTML, encrypt it with StatiCrypt (one password per site), sign it with their deploy key,
  and push it to `site/<repo>`. They call `publish.yml` pinned to a reviewed commit of this repo.
- `deploy.yml` runs every 10 minutes, verifies each site's signature against `registry.json`, and publishes `master`
  plus the registered `site/*` branches. Private pages live at `/p/<repo>/`.
- `master` is protected: changes go through pull requests.
- The 2018 portfolio lives in [`archive/`](archive/) (third-party scripts vendored under `archive/vendor/`).

See `CLAUDE.md` for the rules.
