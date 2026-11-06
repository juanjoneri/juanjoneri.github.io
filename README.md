# juanjoneri.github.io

Public hub for https://juanjoneri.github.io. The landing page only lists the sites; how they are built is in
[`MANUAL.md`](MANUAL.md).

- Private repos build plain HTML, encrypt it with StatiCrypt (one password per site), sign it with their deploy key,
  and push it to `site/<repo>`. They call `publish.yml` pinned to a reviewed commit of this repo.
- `deploy.yml` runs whenever a site is pushed (plus a 10-minute fallback), verifies each site's signature against `registry.json`, and publishes `master`
  plus the registered `site/*` branches. Private pages live at `/p/<repo>/`.
- `master` is protected: changes go through pull requests.
- The 2018 portfolio is kept in [`archive/`](archive/) for posterity; it is not deployed.

- Every private project follows [`STANDARD.md`](STANDARD.md) (shared tooling in `kit/`).

See `CLAUDE.md` for the rules.
