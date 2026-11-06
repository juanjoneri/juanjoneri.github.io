#!/usr/bin/env python3
"""Reporting (STANDARD.md §7), run by publish.yml between Build and Encrypt.

  status_publish.py STATUS DIST OUT

1. Validates the project's full status.json (job names, timestamps, failing step).
2. Embeds it in every page under DIST that has a `data-site-status` element, BEFORE encryption, so the details are
   readable only inside the encrypted page.
3. Writes the public summary OUT/status.json: only {"version": 2, "slug", "failed", "ok_until"}. The landing page
   shows a warning sign from it and nothing else."""
import json, subprocess, sys
from pathlib import Path

status_file, dist, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
here = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(here / "status_check.py"), str(status_file)], check=True)
s = json.loads(status_file.read_text())

blob = json.dumps(s, sort_keys=True).replace("</", "<\\/")
tag = f'<script type="application/json" id="site-status-data">{blob}</script>'
n = 0
for f in sorted(dist.rglob("*.html")):
    html = f.read_text(encoding="utf-8")
    i = html.find("data-site-status")
    if i < 0:
        continue
    start = html.rfind("<", 0, i)
    f.write_text(html[:start] + tag + html[start:], encoding="utf-8")
    n += 1
print(f"status: embedded in {n} page(s)")

alert = [j for j in s["jobs"].values() if j.get("mode", "alert") == "alert"]
failed = any(j.get("result") == "failed" for j in alert)
until = [j.get("stale_after") for j in alert]
ok_until = None if (not until or None in until) else min(until)
out.mkdir(parents=True, exist_ok=True)
(out / "status.json").write_text(json.dumps({"version": 2, "slug": s["slug"], "failed": failed, "ok_until": ok_until},
                                            sort_keys=True) + "\n")
print(f"status: public summary failed={failed} ok_until={ok_until}")
