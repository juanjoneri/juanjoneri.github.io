#!/usr/bin/env python3
"""Validate status files (reporting, STANDARD.md §7).
  status_check.py FILE [SLUG]            the project's full status.json (embedded only inside encrypted pages)
  status_check.py --public FILE [SLUG]   the public summary {version: 2, slug, failed, ok_until} (landing page)
Only fixed fields with fixed shapes may appear. Exit 0 if valid."""
import json, re, sys

ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
NAME = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
STEP = re.compile(r"^[A-Za-z0-9 _./:-]{1,60}$")
FIELDS = {"runs_on": {"mac", "actions", "linux"}, "mode": {"alert", "reminder"}, "result": {"ok", "failed"}}


def bad(msg):
    print(f"status.json: {msg}", file=sys.stderr)
    sys.exit(1)


args = sys.argv[1:]
public = args[:1] == ["--public"]
if public:
    args = args[1:]
raw = open(args[0], "rb").read()
if len(raw) > 32_000:
    bad("too large")
try:
    s = json.loads(raw)
except ValueError:
    bad("not JSON")
if len(args) > 1 and isinstance(s, dict) and s.get("slug") != args[1]:
    bad(f"slug {s.get('slug')!r} != {args[1]!r}")
if public:
    if not isinstance(s, dict) or set(s) != {"version", "slug", "failed", "ok_until"} or s["version"] != 2:
        bad("public summary must be exactly {version: 2, slug, failed, ok_until}")
    if not isinstance(s["failed"], bool) or not (s["ok_until"] is None or (isinstance(s["ok_until"], str) and ISO.match(s["ok_until"]))):
        bad("public summary: bad failed/ok_until")
    sys.exit(0)
if not isinstance(s, dict) or set(s) - {"version", "slug", "jobs"} or s.get("version") != 1:
    bad("unexpected top-level keys or version")
jobs = s.get("jobs")
if not isinstance(jobs, dict) or len(jobs) > 10:
    bad("jobs must be an object with at most 10 entries")
for name, j in jobs.items():
    if not NAME.match(name) or not isinstance(j, dict):
        bad(f"bad job {name!r}")
    extra = set(j) - {"runs_on", "mode", "last_run", "last_ok", "result", "step", "code", "stale_after"}
    if extra:
        bad(f"{name}: unexpected keys {sorted(extra)}")
    for k, allowed in FIELDS.items():
        if j.get(k) is not None and j[k] not in allowed:
            bad(f"{name}.{k} = {j[k]!r}")
    for k in ("last_run", "last_ok", "stale_after"):
        if j.get(k) is not None and not (isinstance(j[k], str) and ISO.match(j[k])):
            bad(f"{name}.{k} is not a UTC timestamp")
    if j.get("step") is not None and not (isinstance(j["step"], str) and STEP.match(j["step"])):
        bad(f"{name}.step has unexpected characters")
    if j.get("code") is not None and not (isinstance(j["code"], int) and 0 <= j["code"] < 1000):
        bad(f"{name}.code must be a small integer")
