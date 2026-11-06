# juanjoneri.github.io

Public hub for https://juanjoneri.github.io — the landing page is the manual for how pages here are built.

- Private repos build plain HTML, encrypt it with StatiCrypt (one password per site), and push it to `site/<repo>`.
- `deploy.yml` publishes master + registered `site/*` branches. Private pages live at `/p/<repo>/`.
- The 2018 portfolio lives in [`archive/`](archive/).

See `CLAUDE.md` for the rules.
