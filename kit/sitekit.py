#!/usr/bin/env python3
"""sitekit: the shared tooling of the private-project standard (STANDARD.md in juanjoneri/juanjoneri.github.io).

Each project vendors this file as .kit/sitekit.py and drives it from site.json. Python 3.9+, standard library only;
external tools: git, and `age` for state encryption.

  sitekit.py setup [--update REF]   bootstrap a machine: setup commands, restore state, install schedules, doctor
  sitekit.py doctor [--quick]       check every dependency; exit 1 if anything required is missing
  sitekit.py run JOB [--offline]    run one job: update code from GitHub (tested), command, status, save, push
  sitekit.py test                   build from the committed fake data (site.json "test"; no secrets, no real data)
  sitekit.py ingest SOURCE PATH...  add source files (zips are unpacked) to the raw store, losslessly
  sitekit.py save                   encrypt new raw segments + state.db (+ warm caches) and push the `state` branch
  sitekit.py restore [--force]      fetch the `state` branch and decrypt it into the local state files
  sitekit.py report JOB --ok | --fail STEP [--code N]   update status.json (used by the hub's publish workflow)
  sitekit.py keygen                 point site.json at the shared data key (creates SITES_DATA_KEY once, ever)
  sitekit.py rekey                  re-encrypt the whole `state` branch to the shared key (one-time migration)
  sitekit.py schedule               install (macOS) or print (Linux) the schedules of this machine's jobs
  sitekit.py secret NAME            print a secret (for scripts; never log the output)
  sitekit.py due JOB [--after ISO]  debug: when the job is next due and when it turns stale
  sitekit.py recovery               (re)write RECOVERY.md from site.json
"""
import argparse
import datetime as dt
import fnmatch
import gzip
import hashlib
import io
import json
import mimetypes
import os
import platform
import re
import shlex
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import zipfile
import zlib
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    sys.exit("sitekit needs Python 3.9+")

KIT_VERSION = 2
DATA_KEY = "SITES_DATA_KEY"            # one age key for every project's state (STANDARD.md §5.4)
LEGACY_KEY = "STATE_AGE_KEY"           # v1 per-project key, still read so old saves can be migrated
DEP_FILES = ("site.json", "requirements.txt", "requirements-dev.txt", "pyproject.toml", "uv.lock", "package.json",
             "package-lock.json", "Gemfile.lock")  # a change here re-runs the setup commands after a code update
HUB = "juanjoneri/juanjoneri.github.io"
UTC = dt.timezone.utc
PART_BYTES = 90 * 1024 * 1024          # GitHub rejects files over 100 MB
SEGMENT_BYTES = 256 * 1024 * 1024      # stored bytes per raw segment
PUSH_BATCH_BYTES = 1024 * 1024 * 1024  # GitHub rejects pushes over 2 GB
STATUS_FILE = "status.json"
MAC = platform.system() == "Darwin"


# ----------------------------------------------------------------------------------------------------------- basics
def find_root():
    p = Path.cwd().resolve()
    for d in [p, *p.parents]:
        if (d / "site.json").exists():
            return d
    sys.exit("no site.json here or above")


ROOT = None
CONF = {}


def load():
    global ROOT, CONF
    ROOT = find_root()
    CONF = json.loads((ROOT / "site.json").read_text())
    CONF.setdefault("slug", ROOT.name)
    CONF.setdefault("jobs", [])
    CONF.setdefault("secrets", [])
    CONF.setdefault("tools", [])
    CONF.setdefault("checks", [])
    CONF.setdefault("setup", [])
    st = CONF.setdefault("state", {})
    st.setdefault("dir", "state")
    st.setdefault("state_db", None)       # e.g. "state/state.db" (optional)
    st.setdefault("raw_db", None)         # e.g. "state/raw.db" (optional)
    st.setdefault("warm", [])             # rebuildable but slow caches saved weekly
    st.setdefault("exclude", [])          # fnmatch on "<source>/<path>"; recorded by name + hash only
    st.setdefault("keep", 7)


def now():
    return dt.datetime.now(UTC).replace(microsecond=0)


def iso(t):
    return t.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ") if t else None


def parse_iso(s):
    return dt.datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC) if s else None


def sh(cmd, check=True, capture=False, cwd=None, env=None, quiet=False):
    if not quiet:
        print("  $ " + (cmd if isinstance(cmd, str) else " ".join(shlex.quote(c) for c in cmd)), flush=True)
    r = subprocess.run(cmd, shell=isinstance(cmd, str), cwd=cwd or ROOT, env=env,
                       stdout=subprocess.PIPE if capture else None, stderr=subprocess.PIPE if capture else None,
                       text=True)
    if check and r.returncode != 0:
        raise SystemExit(f"command failed ({r.returncode}): {cmd}\n{(r.stderr or '')[-2000:]}")
    return r


def git(*args, cwd=None, check=True):
    r = subprocess.run(["git", *args], cwd=cwd or ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout.strip()


def job(name):
    for j in CONF["jobs"]:
        if j["name"] == name:
            return j
    sys.exit(f"no job {name!r} in site.json (have: {', '.join(j['name'] for j in CONF['jobs'])})")


def p(rel):
    return ROOT / rel if rel else None


# ---------------------------------------------------------------------------------------------------------- secrets
def secret_service(name):
    """Keychain service / config path segment: the shared data key is one per machine, the rest per project."""
    return f"site/{name}" if name == DATA_KEY else f"site/{CONF['slug']}/{name}"


def get_secret(name):
    """Mac Keychain `site/<slug>/<NAME>` (shared key: `site/SITES_DATA_KEY`) → env `<NAME>` →
    file ~/.config/site/<slug>/<NAME> (shared key: ~/.config/site/SITES_DATA_KEY). Never printed."""
    if MAC:
        r = subprocess.run(["security", "find-generic-password", "-s", secret_service(name), "-w"],
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        if r.returncode == 0:
            return r.stdout.rstrip("\n")
        alias = next((s.get("keychain") for s in CONF["secrets"] if s["name"] == name and s.get("keychain")), None)
        if alias:  # legacy Keychain service name mapped in site.json
            r = subprocess.run(["security", "find-generic-password", "-s", alias, "-w"],
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
            if r.returncode == 0:
                return r.stdout.rstrip("\n")
    if os.environ.get(name):
        return os.environ[name]
    f = Path.home() / ".config" / secret_service(name)
    if f.exists():
        return f.read_text().rstrip("\n")
    return None


def secret_names():
    return {s["name"] for s in CONF["secrets"]} | {DATA_KEY, LEGACY_KEY, "STATICRYPT_PASSWORD", "HUB_DEPLOY_KEY"}


def clean_env(**extra):
    """The environment without any secret: for tests and anything that runs code we haven't vetted yet."""
    env = {k: v for k, v in os.environ.items() if k not in secret_names()}
    env.update(extra)
    return env


def identity_keys():
    """Private keys this machine can decrypt with: the shared key, plus the legacy per-project key if present."""
    keys = [k for k in (get_secret(DATA_KEY), get_secret(LEGACY_KEY)) if k]
    return [l.strip() for k in keys for l in k.splitlines() if l.strip().startswith("AGE-SECRET-KEY-")]


def public_of(key):
    r = subprocess.run(["age-keygen", "-y"], input=key + "\n", text=True, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE)
    return r.stdout.strip() if r.returncode == 0 else None


# ------------------------------------------------------------------------------------------------- schedule (cron)
def _field(spec, lo, hi):
    out = set()
    for part in spec.split(","):
        step = 1
        if "/" in part:
            part, s = part.split("/")
            step = int(s)
        if part == "*":
            a, b = lo, hi
        elif "-" in part:
            a, b = map(int, part.split("-"))
        else:
            a = b = int(part)
        out.update(range(a, b + 1, step))
    return out


def _cron(expr):
    m, h, dom, mon, dow = expr.split()
    days = _field(dow, 0, 7)
    if 7 in days:
        days.add(0)
    return (_field(m, 0, 59), _field(h, 0, 23), _field(dom, 1, 31), _field(mon, 1, 12), days,
            dom != "*", dow != "*")


def next_run(schedule, after):
    """First scheduled time strictly after `after` (UTC datetime) across all {cron, tz} entries, or None."""
    best = None
    for e in schedule:
        tz = ZoneInfo(e.get("tz", "UTC"))
        mins, hours, doms, mons, dows, dom_set, dow_set = _cron(e["cron"])
        t = after.astimezone(tz).replace(second=0, microsecond=0) + dt.timedelta(minutes=1)
        end = t + dt.timedelta(days=40)
        while t < end:
            if t.month not in mons:
                t = (t.replace(day=1, hour=0, minute=0) + dt.timedelta(days=32)).replace(day=1)
                continue
            dow = (t.weekday() + 1) % 7
            day_ok = ((t.day in doms) or (dow in dows)) if (dom_set and dow_set) else (t.day in doms and dow in dows)
            if not day_ok:
                t = (t + dt.timedelta(days=1)).replace(hour=0, minute=0)
                continue
            if t.hour not in hours:
                t = (t + dt.timedelta(hours=1)).replace(minute=0)
                continue
            if t.minute in mins:
                # skip wall times that don't exist (DST gap): round-trip must preserve the wall clock
                u = t.astimezone(UTC)
                if u.astimezone(tz).replace(tzinfo=None) == t.replace(tzinfo=None):
                    if best is None or u < best:
                        best = u
                    break
            t = t + dt.timedelta(minutes=1)
    return best


def stale_after(j, last_ok):
    """When this job's data becomes stale: next scheduled run after the last success + grace; or, for reminder
    jobs, last success + every_days."""
    if not last_ok:
        return None
    f = j.get("freshness", {})
    if f.get("mode") == "reminder":
        return last_ok + dt.timedelta(days=f.get("every_days", 30))
    if not j.get("schedule"):
        return None
    nxt = next_run(j["schedule"], last_ok)
    return nxt + dt.timedelta(minutes=f.get("grace_minutes", 90)) if nxt else None


# ------------------------------------------------------------------------------------------------------- reporting
STATUS_KEYS = {"runs_on", "mode", "last_run", "last_ok", "result", "step", "code", "stale_after", "rev"}


def read_status():
    f = ROOT / STATUS_FILE
    return json.loads(f.read_text()) if f.exists() else {"version": 1, "slug": CONF["slug"], "jobs": {}}


def head_rev():
    r = subprocess.run(["git", "rev-parse", "--short=7", "HEAD"], cwd=ROOT, text=True, stdout=subprocess.PIPE,
                       stderr=subprocess.DEVNULL)
    return r.stdout.strip() or None if r.returncode == 0 else None


def write_status(job_name, ok, step=None, code=None, at=None, ran=None, rev=None):
    """ok: the run is healthy. ran: the job itself succeeded (defaults to ok); a run can succeed with an old code
    version because the new one failed its test: then ran=True (last_ok moves) and ok=False (it shows as failed)."""
    j = job(job_name)
    if step:  # status_check.py allows only these characters in step
        step = re.sub(r"[^A-Za-z0-9 _./:-]", "", str(step))[:60]
    s = read_status()
    s["version"], s["slug"] = 1, CONF["slug"]
    rec = s["jobs"].get(job_name, {})
    at = at or now()
    rec.update(runs_on=j.get("runs_on", "mac"), mode=j.get("freshness", {}).get("mode", "alert"), last_run=iso(at),
               result="ok" if ok else "failed", step=None if ok else step, code=None if ok else code,
               rev=rev or head_rev())
    if ok if ran is None else ran:
        rec["last_ok"] = iso(at)
    rec["stale_after"] = iso(stale_after(j, parse_iso(rec.get("last_ok"))))
    s["jobs"][job_name] = {k: rec.get(k) for k in sorted(STATUS_KEYS)}
    # drop jobs no longer in site.json
    s["jobs"] = {k: v for k, v in s["jobs"].items() if any(x["name"] == k for x in CONF["jobs"])}
    (ROOT / STATUS_FILE).write_text(json.dumps(s, indent=2, sort_keys=True) + "\n")
    return s


def cmd_report(a):
    if not a.ok and not a.fail:
        sys.exit("report needs --ok or --fail STEP")
    write_status(a.job, a.ok, step=a.fail, code=a.code)
    print(f"status: {a.job} {'ok' if a.ok else 'failed at ' + a.fail}")


def cmd_due(a):
    j = job(a.job)
    after = parse_iso(a.after) if a.after else now()
    print("next run   ", iso(next_run(j.get("schedule", []), after)) if j.get("schedule") else "(no schedule)")
    print("stale after", iso(stale_after(j, after)))


# -------------------------------------------------------------------------------------------------------- raw store
RAW_SCHEMA = """
CREATE TABLE IF NOT EXISTS raw_files(
  id INTEGER PRIMARY KEY, source TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL UNIQUE, bytes INTEGER NOT NULL,
  mtime TEXT, imported_at TEXT NOT NULL, media_type TEXT, compression TEXT NOT NULL DEFAULT 'none',
  meta TEXT NOT NULL DEFAULT '{}', segment TEXT, content BLOB NOT NULL);
CREATE INDEX IF NOT EXISTS raw_files_source_path ON raw_files(source, path);
CREATE TABLE IF NOT EXISTS excluded(source TEXT, path TEXT, sha256 TEXT, bytes INTEGER, pattern TEXT, imported_at TEXT,
  UNIQUE(sha256, path));
CREATE TABLE IF NOT EXISTS sightings(sha256 TEXT, source TEXT, path TEXT, seen_at TEXT, UNIQUE(sha256, source, path));
"""


def raw_db():
    f = p(CONF["state"]["raw_db"])
    if not f:
        sys.exit("site.json has no state.raw_db")
    f.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(f)
    c.executescript(RAW_SCHEMA)
    return c


def read_blob(row_compression, content):
    return zlib.decompress(content) if row_compression == "zlib" else content


def _store(c, source, path, data, mtime, meta, stats):
    h = hashlib.sha256(data).hexdigest()
    key = f"{source}/{path}"
    c.execute("INSERT OR IGNORE INTO sightings VALUES(?,?,?,?)", (h, source, path, iso(now())))
    for pat in CONF["state"]["exclude"]:
        if fnmatch.fnmatch(key, pat):
            c.execute("INSERT OR IGNORE INTO excluded VALUES(?,?,?,?,?,?)", (source, path, h, len(data), pat, iso(now())))
            stats["excluded"] += 1
            return
    if c.execute("SELECT 1 FROM raw_files WHERE sha256=?", (h,)).fetchone():
        stats["known"] += 1
        return
    z = zlib.compress(data, 6)
    comp, blob = ("zlib", z) if len(z) < 0.9 * len(data) else ("none", data)
    mt = mimetypes.guess_type(path.split("!/")[-1])[0]
    c.execute("INSERT INTO raw_files(source,path,sha256,bytes,mtime,imported_at,media_type,compression,meta,content)"
              " VALUES(?,?,?,?,?,?,?,?,?,?)",
              (source, path, h, len(data), mtime, iso(now()), mt, comp, json.dumps(meta, sort_keys=True), blob))
    stats["new"] += 1
    stats["bytes"] += len(data)


def _ingest_zip(c, source, zpath, data, mtime, stats, depth=0):
    zf = zipfile.ZipFile(io.BytesIO(data))
    encrypted = any(i.flag_bits & 0x1 for i in zf.infolist())
    if encrypted or depth > 3:
        # can't read members: keep the archive itself byte for byte
        _store(c, source, zpath, data, mtime, {"archive": "zip", "encrypted": encrypted,
                                                "members": [i.filename for i in zf.infolist()]}, stats)
        return
    for i in zf.infolist():
        if i.is_dir():
            continue
        member = zf.read(i)
        mpath = f"{zpath}!/{i.filename}"
        meta = {"zip_date_time": list(i.date_time), "zip_crc": i.CRC}
        if i.filename.lower().endswith(".zip"):
            _ingest_zip(c, source, mpath, member, mtime, stats, depth + 1)
        else:
            _store(c, source, mpath, member, mtime, meta, stats)


def ingest_bytes(c, source, path, data, mtime=None, meta=None, stats=None):
    stats = stats if stats is not None else {"new": 0, "known": 0, "excluded": 0, "bytes": 0}
    if path.lower().endswith(".zip") and zipfile.is_zipfile(io.BytesIO(data)):
        _ingest_zip(c, source, path, data, mtime, stats)
    else:
        _store(c, source, path, data, mtime, meta or {}, stats)
    return stats


def cmd_ingest(a):
    c = raw_db()
    stats = {"new": 0, "known": 0, "excluded": 0, "bytes": 0}
    meta = json.loads(a.meta) if a.meta else {}
    for arg in a.paths:
        base = Path(arg).resolve()
        files = [base] if base.is_file() else sorted(x for x in base.rglob("*") if x.is_file())
        for f in files:
            if f.name == ".DS_Store":
                continue
            rel = f.name if base.is_file() else f.relative_to(base).as_posix()
            rel = f"{a.prefix.rstrip('/')}/{rel}" if a.prefix else rel
            mtime = iso(dt.datetime.fromtimestamp(f.stat().st_mtime, UTC))
            ingest_bytes(c, a.source, rel, f.read_bytes(), mtime, meta, stats)
    c.commit()
    print(f"ingest {a.source}: {stats['new']} new ({stats['bytes'] / 1e6:.1f} MB), {stats['known']} already stored, "
          f"{stats['excluded']} excluded")


# ------------------------------------------------------------------------------------------------ state branch I/O
def branch_dir():
    return ROOT / ".state-branch"


def age_recipient():
    r = CONF["state"].get("recipient")
    if not r:
        sys.exit("site.json state.recipient is missing: run `sitekit.py keygen` once")
    return r


def identity_file(tmp):
    keys = identity_keys()
    if not keys:
        return None
    f = Path(tmp) / "identity"
    f.write_text("\n".join(keys) + "\n")
    f.chmod(0o600)
    return f


def encrypt_to(src, dest_base):
    """age-encrypt src to dest_base + '.age', split into dest_base.age.000… parts when large. Returns part names."""
    tmp = dest_base.parent / (dest_base.name + ".age.tmp")
    sh(["age", "-r", age_recipient(), "-o", str(tmp), str(src)], quiet=True)
    for old in dest_base.parent.glob(dest_base.name + ".age*"):
        if old != tmp:
            old.unlink()
    parts = []
    size = tmp.stat().st_size
    if size <= PART_BYTES:
        tmp.rename(dest_base.parent / (dest_base.name + ".age"))
        return [dest_base.name + ".age"]
    with open(tmp, "rb") as f:
        i = 0
        while True:
            chunk = f.read(PART_BYTES)
            if not chunk:
                break
            name = f"{dest_base.name}.age.{i:03d}"
            (dest_base.parent / name).write_bytes(chunk)
            parts.append(name)
            i += 1
    tmp.unlink()
    return parts


def decrypt_parts(folder, parts, dest, identity_file):
    joined = dest.parent / (dest.name + ".age.joined")
    with open(joined, "wb") as out:
        for part in parts:
            out.write((folder / part).read_bytes())
    sh(["age", "-d", "-i", str(identity_file), "-o", str(dest), str(joined)], quiet=True)
    joined.unlink()


def remote_url():
    return git("remote", "get-url", "origin")


def open_branch(fetch=True):
    d = branch_dir()
    if not (d / ".git").exists():
        d.mkdir(exist_ok=True)
        git("init", "-q", cwd=d)
        git("remote", "add", "origin", remote_url(), cwd=d)
    else:
        git("remote", "set-url", "origin", remote_url(), cwd=d)
    exists = False
    if fetch:
        r = subprocess.run(["git", "fetch", "-q", "--depth", "1", "origin", "+refs/heads/state:refs/remotes/origin/state"],
                           cwd=d, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        exists = r.returncode == 0
        if exists:
            git("checkout", "-q", "-f", "--detach", "origin/state", cwd=d)
            git("clean", "-qfdx", cwd=d)
    if not exists:  # never build on leftovers of an earlier, failed save
        for x in d.iterdir():
            if x.name != ".git":
                shutil.rmtree(x) if x.is_dir() else x.unlink()
    return d, exists


def read_manifest(d):
    f = d / "manifest.json"
    return json.loads(f.read_text()) if f.exists() else {"version": 1, "state": [], "raw": [], "warm": []}


def push_branch(d, message):
    git("add", "-A", cwd=d)
    tree = git("write-tree", cwd=d)
    env = dict(os.environ, GIT_AUTHOR_NAME="sitekit", GIT_AUTHOR_EMAIL="sitekit@users.noreply.github.com",
               GIT_COMMITTER_NAME="sitekit", GIT_COMMITTER_EMAIL="sitekit@users.noreply.github.com")
    commit = subprocess.run(["git", "commit-tree", tree, "-m", message], cwd=d, env=env, text=True,
                            stdout=subprocess.PIPE, check=True).stdout.strip()
    for attempt in range(4):
        r = subprocess.run(["git", "push", "-q", "-f", "origin", f"{commit}:refs/heads/state"], cwd=d, text=True,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if r.returncode == 0:
            git("update-ref", "refs/remotes/origin/state", commit, cwd=d)
            git("checkout", "-q", "--detach", commit, cwd=d)
            return commit
        time.sleep(2 ** (attempt + 1))
    raise SystemExit(f"pushing the state branch failed: {r.stderr.strip()}")


def cmd_save(a=None):
    st = CONF["state"]
    if not (st["state_db"] or st["raw_db"] or st["warm"]):
        print("save: this project keeps no state")
        return
    d, _ = open_branch()
    man = read_manifest(d)
    if man.get("recipient", "legacy") != age_recipient() and (man["raw"] or man["state"] or man.get("warm")):
        if identity_keys():
            print("  state branch is encrypted to another key: re-encrypting it to the shared key first")
            rekey(d, man)
        else:
            print(f"  warning: older saves use another key and {DATA_KEY}/{LEGACY_KEY} aren't here to migrate them")
    if not (man["raw"] or man["state"] or man.get("warm")):
        man["recipient"] = age_recipient()  # a fresh branch starts on the current key
    (d / "README.md").write_text(
        f"# State of {CONF['slug']}\n\nEncrypted with age (recipient in site.json). Written by sitekit; never edit.\n"
        f"Restore: `python3 .kit/sitekit.py restore` (needs {DATA_KEY}).\n")
    ts = now().strftime("%Y%m%dT%H%M%SZ")
    pending = 0
    unmarked = []  # (segment, ids): rows are marked as saved only after the push that carries them succeeds

    def checkpoint(msg):
        man["saved_at"] = iso(now())
        (d / "manifest.json").write_text(json.dumps(man, indent=2) + "\n")
        push_branch(d, msg)
        if unmarked:
            for seg_id, seg_ids in unmarked:
                q2 = ",".join("?" * len(seg_ids))
                c.execute(f"UPDATE raw_files SET segment=? WHERE id IN ({q2})", [seg_id, *seg_ids])
            c.commit()
            unmarked.clear()

    # raw: rows not yet in a segment -> new immutable segments (encrypted once, never rewritten)
    c = raw_db() if st["raw_db"] and p(st["raw_db"]).exists() else None
    if c:
        (d / "raw").mkdir(exist_ok=True)
        taken = set()
        while True:
            ids, size = [], 0
            for rid, n in c.execute("SELECT id, length(content) FROM raw_files WHERE segment IS NULL ORDER BY id"):
                if rid in taken:
                    continue
                if ids and size + n > SEGMENT_BYTES:
                    break
                ids.append(rid)
                size += n
            if not ids:
                break
            taken.update(ids)
            seg = f"{ts}-{len(man['raw']):05d}"
            with tempfile.TemporaryDirectory() as tmp:
                sf = Path(tmp) / f"{seg}.db"
                s = sqlite3.connect(sf)
                s.executescript(RAW_SCHEMA)
                s.execute("ATTACH ? AS src", (str(p(st["raw_db"])),))
                q = ",".join("?" * len(ids))
                s.execute(f"INSERT INTO raw_files SELECT * FROM src.raw_files WHERE id IN ({q})", ids)
                s.execute("UPDATE raw_files SET segment=?", (seg,))
                s.commit()
                s.execute("DETACH src")
                s.close()
                plain = hashlib.sha256(sf.read_bytes()).hexdigest()
                parts = encrypt_to(sf, d / "raw" / seg)
            unmarked.append((seg, ids))
            man["raw"].append({"id": seg, "parts": parts, "rows": len(ids), "bytes": size, "sha256": plain})
            print(f"  raw segment {seg}: {len(ids)} files, {size / 1e6:.1f} MB")
            pending += size
            if pending >= PUSH_BATCH_BYTES:  # stay far below GitHub's 2 GB push limit
                checkpoint(f"state {ts} (partial)")
                pending = 0
        # excluded/sightings changes ride in a small "index" segment rewritten each save
        with tempfile.TemporaryDirectory() as tmp:
            xf = Path(tmp) / "index.db"
            x = sqlite3.connect(xf)
            x.executescript(RAW_SCHEMA)
            x.execute("ATTACH ? AS src", (str(p(st["raw_db"])),))
            x.execute("INSERT INTO excluded SELECT * FROM src.excluded")
            x.execute("INSERT INTO sightings SELECT * FROM src.sightings")
            x.commit()
            x.execute("DETACH src")
            x.close()
            man["raw_index"] = encrypt_to(xf, d / "raw" / "index")

    # state.db: consistent copy every save, last N kept
    if st["state_db"] and p(st["state_db"]).exists():
        (d / "state").mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            cp = Path(tmp) / "state.db"
            src = sqlite3.connect(p(st["state_db"]))
            src.execute("VACUUM INTO ?", (str(cp),))
            src.close()
            parts = encrypt_to(cp, d / "state" / f"state-{ts}")
        man["state"].append({"at": ts, "parts": parts})
        for old in man["state"][:-st["keep"]]:
            for part in old["parts"]:
                (d / "state" / part).unlink(missing_ok=True)
        man["state"] = man["state"][-st["keep"]:]

    # warm caches: at most once a week
    if st["warm"]:
        last = man.get("warm_at")
        if not last or now() - parse_iso(last) > dt.timedelta(days=7) or (a and getattr(a, "warm", False)):
            (d / "warm").mkdir(exist_ok=True)
            man["warm"] = []
            for rel in st["warm"]:
                f = p(rel)
                if not f.exists():
                    continue
                with tempfile.TemporaryDirectory() as tmp:
                    cp = Path(tmp) / f.name
                    try:  # SQLite: consistent copy even while in use; anything else: plain copy
                        src = sqlite3.connect(f)
                        src.execute("VACUUM INTO ?", (str(cp),))
                        src.close()
                    except sqlite3.DatabaseError:
                        cp.unlink(missing_ok=True)
                        shutil.copy2(f, cp)
                    name = re.sub(r"[^A-Za-z0-9._-]", "_", rel)
                    man["warm"].append({"path": rel, "parts": encrypt_to(cp, d / "warm" / name)})
            man["warm_at"] = iso(now())
    checkpoint(f"state {ts}")
    if c:
        c.close()
    print(f"saved state to the `state` branch ({len(man['raw'])} raw segments, {len(man['state'])} state copies)")


def cmd_restore(a):
    st = CONF["state"]
    if not identity_keys():
        sys.exit(f"{DATA_KEY} not found (Keychain site/{DATA_KEY}, env {DATA_KEY}, or ~/.config/site/{DATA_KEY})")
    d, exists = open_branch()
    if not exists:
        print("restore: no `state` branch yet; nothing to restore")
        return
    man = read_manifest(d)
    targets = [x for x in (st["raw_db"], st["state_db"]) if x]
    if not a.force and any(p(x).exists() for x in targets):
        sys.exit("local state exists; use --force to overwrite it (the current files are kept as *.bak)")
    with tempfile.TemporaryDirectory() as tmp:
        ident = identity_file(tmp)
        if st["raw_db"]:
            dest = p(st["raw_db"])
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists():
                dest.rename(dest.with_suffix(dest.suffix + ".bak"))
            c = raw_db()
            for seg in man["raw"]:
                sf = Path(tmp) / f"{seg['id']}.db"
                decrypt_parts(d / "raw", seg["parts"], sf, ident)
                if hashlib.sha256(sf.read_bytes()).hexdigest() != seg["sha256"]:
                    sys.exit(f"segment {seg['id']} does not match its manifest hash")
                c.execute("ATTACH ? AS s", (str(sf),))
                c.execute("INSERT INTO raw_files(source,path,sha256,bytes,mtime,imported_at,media_type,compression,"
                          "meta,segment,content) SELECT source,path,sha256,bytes,mtime,imported_at,media_type,"
                          "compression,meta,segment,content FROM s.raw_files ORDER BY id")
                c.commit()
                c.execute("DETACH s")
                sf.unlink()
            if man.get("raw_index"):
                xf = Path(tmp) / "index.db"
                decrypt_parts(d / "raw", man["raw_index"], xf, ident)
                c.execute("ATTACH ? AS s", (str(xf),))
                c.execute("INSERT OR IGNORE INTO excluded SELECT * FROM s.excluded")
                c.execute("INSERT OR IGNORE INTO sightings SELECT * FROM s.sightings")
                c.commit()
                c.execute("DETACH s")
            n = c.execute("SELECT count(*) FROM raw_files").fetchone()[0]
            bad = sum(1 for comp, h, blob in c.execute("SELECT compression, sha256, content FROM raw_files")
                      if hashlib.sha256(read_blob(comp, blob)).hexdigest() != h)
            c.close()
            if bad:
                sys.exit(f"restore: {bad} raw files fail their sha256")
            print(f"  raw: {len(man['raw'])} segments, {n} files, all sha256 verified")
        if st["state_db"] and man["state"]:
            dest = p(st["state_db"])
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists():
                dest.rename(dest.with_suffix(dest.suffix + ".bak"))
            latest = man["state"][-1]
            decrypt_parts(d / "state", latest["parts"], dest, ident)
            print(f"  state.db: copy from {latest['at']}")
        for w in man.get("warm", []):
            dest = p(w["path"])
            if dest.exists() and not a.force:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            decrypt_parts(d / "warm", w["parts"], dest, ident)
            print(f"  warm cache: {w['path']}")
    print(f"restored state saved at {man.get('saved_at')}")


def cmd_keygen(a):
    """Every project encrypts to the one shared key. With SITES_DATA_KEY on this machine, write its public half to
    site.json; with no shared key anywhere yet (once, ever), create it."""
    key = get_secret(DATA_KEY)
    if key:
        pub = public_of(key)
        if not pub:
            sys.exit(f"{DATA_KEY} is not a valid age key")
        created = False
    else:
        if not a.new:
            sys.exit(f"{DATA_KEY} not found on this machine. Put the shared key here (Keychain site/{DATA_KEY}, env, "
                     f"or ~/.config/site/{DATA_KEY}) and rerun; `keygen --new` creates it, once, for all projects.")
        r = subprocess.run(["age-keygen"], text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        key = next(l for l in r.stdout.splitlines() if l.startswith("AGE-SECRET-KEY-"))
        pub = re.search(r"age1[0-9a-z]+", r.stdout + r.stderr).group(0)
        created = True
    conf = json.loads((ROOT / "site.json").read_text())
    old = conf.setdefault("state", {}).get("recipient")
    conf["state"]["recipient"] = pub
    (ROOT / "site.json").write_text(json.dumps(conf, indent=2) + "\n")
    print(f"site.json state.recipient = {pub}" + (f" (was {old})" if old and old != pub else "") + ": commit it.")
    if old and old != pub:
        print("The next save re-encrypts the `state` branch to it (or run `sitekit.py rekey` now).")
    if created:
        print(f"\nPRIVATE KEY (shown once). Save it in the password manager as '{DATA_KEY}', and in the cloud "
              f"environment Claude sessions use for these repos as the env variable {DATA_KEY}:\n")
        print(key)
        if MAC:
            print(f"\nOn this Mac: security add-generic-password -s site/{DATA_KEY} -a \"$USER\" -w")


def rekey(d, man):
    """Re-encrypt every file of the checked-out state branch `d` to the current recipient (decrypting with every key
    this machine has). Plaintext hashes and segment ids don't change. Caller pushes."""
    with tempfile.TemporaryDirectory() as tmp:
        ident = identity_file(tmp)
        groups = [("raw", x["id"], x["parts"], x) for x in man["raw"]]
        if man.get("raw_index"):
            groups.append(("raw", "index", man["raw_index"], None))
        groups += [("state", f"state-{x['at']}", x["parts"], x) for x in man["state"]]
        groups += [("warm", re.sub(r"[^A-Za-z0-9._-]", "_", x["path"]), x["parts"], x) for x in man.get("warm", [])]
        for folder, base, parts, entry in groups:
            plain = Path(tmp) / "plain"
            decrypt_parts(d / folder, parts, plain, ident)
            new = encrypt_to(plain, d / folder / base)
            plain.unlink()
            if entry is None:
                man["raw_index"] = new
            else:
                entry["parts"] = new
    man["recipient"] = age_recipient()
    print(f"  re-encrypted {len(groups)} file(s) to {age_recipient()[:16]}…")


def cmd_rekey(a):
    if not identity_keys():
        sys.exit(f"rekey needs the key the state is encrypted with ({LEGACY_KEY} or {DATA_KEY}) on this machine")
    d, exists = open_branch()
    if not exists:
        sys.exit("no `state` branch yet")
    man = read_manifest(d)
    rekey(d, man)
    man["saved_at"] = iso(now())
    (d / "manifest.json").write_text(json.dumps(man, indent=2) + "\n")
    push_branch(d, f"rekey to the shared key {iso(now())}")
    print("state branch now encrypted to the shared key")


# ------------------------------------------------------------------------------------------------------------- run
def commit_outputs(paths, message):
    """One commit on top of origin/main with only `paths` (+ status.json); never takes code from GitHub."""
    paths = [x for x in paths if (ROOT / x).exists()] + [STATUS_FILE]
    branch = CONF.get("branch", "main")
    for attempt in range(4):
        git("fetch", "-q", "origin", branch)
        env = dict(os.environ, GIT_INDEX_FILE=str(ROOT / ".git" / "sitekit-index"))
        subprocess.run(["git", "read-tree", f"origin/{branch}"], cwd=ROOT, env=env, check=True)
        subprocess.run(["git", "add", "-A", "--", *paths], cwd=ROOT, env=env, check=True)
        tree = subprocess.run(["git", "write-tree"], cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE,
                              check=True).stdout.strip()
        if tree == git("rev-parse", f"origin/{branch}^{{tree}}"):
            print("  nothing to commit")
            return
        c = subprocess.run(["git", "commit-tree", tree, "-p", f"origin/{branch}", "-m", message], cwd=ROOT, env=env,
                           text=True, stdout=subprocess.PIPE, check=True).stdout.strip()
        r = subprocess.run(["git", "push", "-q", "origin", f"{c}:refs/heads/{branch}"], cwd=ROOT, text=True,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if r.returncode == 0:
            print(f"  pushed {c[:7]} to {branch}")
            return
        time.sleep(3 * (attempt + 1))
    raise SystemExit("could not push outputs (the next run retries)")


def changed_files(old, new):
    return set(git("diff", "--name-only", old, new).splitlines()) if old != new else set()


def update_code():
    """Bring this checkout to origin/<branch> before a run (STANDARD.md §6.5). Fast-forward only; the job outputs and
    status.json (which the runs themselves commit to GitHub) may be overwritten, any other local change blocks it.
    The new code must pass `test` (fake data, no secrets) or the checkout goes back to the old commit.
    Returns (problem or None, re-exec?)."""
    branch = CONF.get("branch", "main")
    r = subprocess.run(["git", "fetch", "-q", "origin", branch], cwd=ROOT, text=True, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE)
    if r.returncode != 0:
        return "code update: git fetch failed", False
    old, new = git("rev-parse", "HEAD"), git("rev-parse", f"origin/{branch}")
    if old == new:
        return None, False
    if subprocess.run(["git", "merge-base", "--is-ancestor", "HEAD", f"origin/{branch}"], cwd=ROOT).returncode != 0:
        return "code update: local commits not on GitHub", False
    ours = {o for j in CONF["jobs"] for o in j.get("outputs", [])} | {STATUS_FILE}
    raw = subprocess.run(["git", "status", "--porcelain", "-z", "--untracked-files=no"], cwd=ROOT, text=True,
                         stdout=subprocess.PIPE, check=True).stdout
    dirty = [e[3:] for e in raw.split("\0") if len(e) > 3]
    blocking = [f for f in dirty if not any(f == o or f.startswith(o.rstrip("/") + "/") for o in ours)]
    if blocking:
        return f"code update: local edits in {blocking[0][:30]}", False
    if dirty:
        git("checkout", "-q", "--", *dirty)
    # outputs that exist here untracked (written by runs, committed to GitHub by commit_outputs) would block the merge
    for f in git("ls-files", "--others", "--exclude-standard", "--", *sorted(ours)).splitlines():
        if subprocess.run(["git", "cat-file", "-e", f"origin/{branch}:{f}"], cwd=ROOT,
                          stderr=subprocess.DEVNULL).returncode == 0:
            (ROOT / f).unlink()
    print(f"  code update {old[:7]} -> {new[:7]}", flush=True)
    git("merge", "-q", "--ff-only", f"origin/{branch}")
    files = changed_files(old, new)
    is_ours = lambda f: any(f == o or f.startswith(o.rstrip("/") + "/") for o in ours)
    if all(is_ours(f) for f in files):  # only the runs' own output commits: nothing to test
        return None, False
    conf = json.loads((ROOT / "site.json").read_text())
    try:
        if files & set(DEP_FILES):
            for c in conf.get("setup", []):
                sh(c, cwd=ROOT)
        cmd = conf.get("test")
        if not cmd:
            raise RuntimeError("site.json has no test")
        t = subprocess.run(cmd, shell=True, cwd=ROOT, env=clean_env(SITE_TEST="1", SITE_OFFLINE="1"),
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=1800)
        if t.returncode != 0:
            print(t.stdout[-3000:])
            raise RuntimeError("test failed")
    except (Exception, SystemExit) as e:
        print(f"  {new[:7]} rejected ({e}); staying on {old[:7]}")
        git("reset", "-q", "--hard", old)
        return f"code update: {new[:7]} {str(e)[:30]}", False
    git("checkout", "-q", "--", ".")  # drop whatever the test wrote into tracked files (fake outputs)
    load()  # the new site.json
    if MAC and any(f == "site.json" for f in files):
        cmd_schedule()
    return None, ".kit/sitekit.py" in files


def cmd_run(a):
    j = job(a.job)
    problem = None
    if not a.offline and not a.no_update and j.get("runs_on", "mac") != "actions":
        problem, reexec = update_code()
        if reexec:  # the kit itself changed: continue with the new one
            sys.stdout.flush()
            args = [sys.executable, str(ROOT / ".kit" / "sitekit.py"), "run", a.job, "--no-update"] + \
                (["--no-push"] if a.no_push else [])
            os.execv(sys.executable, args)
        j = job(a.job)
    if not j.get("command"):
        sys.exit(f"{a.job} runs on {j.get('runs_on', '?')} and has no local command"
                 + (f"; build offline with: {CONF['build_offline']}" if CONF.get("build_offline") else ""))
    lock = ROOT / ".git" / f"sitekit-{a.job}.lock"
    try:
        lock.mkdir()
    except FileExistsError:
        if time.time() - lock.stat().st_mtime < 6 * 3600:
            sys.exit(f"{a.job} is already running ({lock})")
        lock.rmdir()
        lock.mkdir()
    started = now()
    print(f"=== {iso(started)} {CONF['slug']} / {a.job} ===", flush=True)
    step, code = "run", 0
    try:
        env = dict(os.environ, SITE_OFFLINE="1" if a.offline else "0", SITE_JOB=a.job)
        for name in j.get("secrets", []):
            v = get_secret(name)
            if v is None:
                step, code = f"secret {name}", 1
                raise RuntimeError
            env[name] = v
        cmd = j.get("offline_command") if a.offline and j.get("offline_command") else j["command"]
        code = subprocess.run(cmd, shell=True, cwd=ROOT, env=env).returncode
        if code != 0:
            raise RuntimeError
        if not a.offline:
            step = "save"
            cmd_save()
    except (Exception, SystemExit) as e:  # any failure is recorded in status.json, then reported
        if isinstance(e, SystemExit) and e.code not in (0, None):
            print(e.code)
            code = code or 1
        elif not isinstance(e, (RuntimeError, SystemExit)):
            print(f"{type(e).__name__}: {e}")
            code = code or 1
        write_status(a.job, False, step=step, code=code or 1, at=started)
        print(f"=== failed at {step} (exit {code or 1}) ===")
        if not a.offline and not a.no_push:
            commit_outputs([], f"{a.job}: failed at {step} {iso(started)}")
        if MAC:
            subprocess.run(["osascript", "-e", f'display notification "failed at {step}" with title '
                            f'"{CONF["slug"]} / {a.job}"'], stderr=subprocess.DEVNULL)
        sys.exit(1)
    finally:
        lock.rmdir() if lock.exists() else None
    write_status(a.job, problem is None, step=problem, ran=True, at=started)
    if not a.offline and not a.no_push:
        commit_outputs(j.get("outputs", []), f"{a.job}: run {iso(started)}")
    print(f"=== ok ({int((now() - started).total_seconds())}s){' but ' + problem if problem else ''} ===")


def cmd_test(a=None):
    cmd = CONF.get("test")
    if not cmd:
        sys.exit("site.json has no `test`: a command that builds the outputs from committed fake data "
                 "(STANDARD.md §8)")
    print(f"  $ {cmd}  (fake data, no secrets)")
    code = subprocess.run(cmd, shell=True, cwd=ROOT, env=clean_env(SITE_TEST="1", SITE_OFFLINE="1")).returncode
    if a is not None:
        sys.exit(code)
    return code


# ------------------------------------------------------------------------------------------------------ schedules
def _cron_list(spec, lo, hi):
    return None if spec == "*" else sorted(_field(spec, lo, hi))


def launchd_intervals(entry):
    """launchd fires in the Mac's local time zone: entries must use the Mac's zone."""
    m, h, dom, mon, dow = entry["cron"].split()
    out = [{}]
    for key, spec, lo, hi in (("Minute", m, 0, 59), ("Hour", h, 0, 23), ("Day", dom, 1, 31), ("Month", mon, 1, 12),
                              ("Weekday", dow, 0, 7)):
        vals = _cron_list(spec, lo, hi)
        if vals is None:
            continue
        out = [dict(d, **{key: v}) for d in out for v in vals]
    return out


def plist(label, args, intervals, log):
    from xml.sax.saxutils import escape

    def val(v):
        if isinstance(v, int):
            return f"<integer>{v}</integer>"
        return f"<string>{escape(str(v))}</string>"
    items = "".join("<dict>" + "".join(f"<key>{k}</key>{val(v)}" for k, v in d.items()) + "</dict>" for d in intervals)
    argv = "".join(val(x) for x in args)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
            '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>'
            f"<key>Label</key>{val(label)}<key>ProgramArguments</key><array>{argv}</array>"
            f"<key>StartCalendarInterval</key><array>{items}</array>"
            f"<key>StandardOutPath</key>{val(log)}<key>StandardErrorPath</key>{val(log)}"
            "</dict></plist>\n")


def local_jobs():
    return [j for j in CONF["jobs"] if j.get("runs_on") == "mac" and j.get("schedule")]


def cmd_schedule(a=None):
    for j in local_jobs():
        label = f"site.{CONF['slug']}.{j['name']}"
        intervals = [d for e in j["schedule"] for d in launchd_intervals(e)]
        log = ROOT / ".git" / f"sitekit-{j['name']}.log"
        run = [sys.executable, str(ROOT / ".kit" / "sitekit.py"), "run", j["name"]]
        if j.get("launch") == "terminal":  # jobs that need Terminal's Full Disk Access
            cmdfile = ROOT / ".git" / f"sitekit-{j['name']}.command"
            cmdfile.write_text(f"#!/bin/bash\ncd {shlex.quote(str(ROOT))} && "
                               f"{' '.join(shlex.quote(x) for x in run)} >> {shlex.quote(str(log))} 2>&1\n"
                               "status=$?; [ $status -eq 0 ] && osascript -e 'tell application \"Terminal\" to close "
                               "front window' >/dev/null 2>&1 &\nexit $status\n")
            cmdfile.chmod(0o755)
            args = ["/usr/bin/open", "-g", "-a", "Terminal", str(cmdfile)]
        else:
            args = ["/bin/bash", "-lc", f"cd {shlex.quote(str(ROOT))} && {' '.join(shlex.quote(x) for x in run)}"]
        if MAC:
            tzs = {e.get("tz", "UTC") for e in j["schedule"]}
            local = time.tzname
            f = Path.home() / "Library" / "LaunchAgents" / f"{label}.plist"
            f.write_text(plist(label, args, intervals, log))
            uid = os.getuid()
            subprocess.run(["launchctl", "bootout", f"gui/{uid}", str(f)], stderr=subprocess.DEVNULL)
            sh(["launchctl", "bootstrap", f"gui/{uid}", str(f)])
            print(f"  installed {label} ({len(intervals)} times; schedule zones {', '.join(sorted(tzs))}, "
                  f"Mac zone {local[0]})")
        else:
            print(f"  {label}: not macOS; add to crontab (times in this machine's zone):")
            for e in j["schedule"]:
                print(f"    {e['cron']} {' '.join(shlex.quote(x) for x in run)} >> {log} 2>&1")


# ---------------------------------------------------------------------------------------------------------- doctor
class Doctor:
    def __init__(self):
        self.fail = 0
        self.warn = 0

    def ok(self, what, detail=""):
        print(f"  ✅ {what}{('  ' + detail) if detail else ''}")

    def bad(self, what, fix, required=True):
        if required:
            self.fail += 1
        else:
            self.warn += 1
        print(f"  {'❌' if required else '⚠️ '} {what}\n      fix: {fix}")


def cmd_doctor(a):
    D = Doctor()
    here = [j for j in CONF["jobs"] if j.get("runs_on") == ("mac" if MAC else "linux")]
    print(f"{CONF['slug']} — doctor ({'macOS' if MAC else platform.system()}, Python {platform.python_version()})")

    print("location")
    parent = Path(os.environ.get("SITE_PARENT", Path.home() / "Code")).expanduser()
    if ROOT.parent.resolve() == parent.resolve() and ROOT.name == CONF["slug"]:
        D.ok(f"{ROOT}")
    else:
        D.bad(f"repo is at {ROOT}", f"move it to {parent / CONF['slug']} (all projects share one parent; "
              "SITE_PARENT overrides)", required=MAC)

    print("kit")
    pinned = CONF.get("kit")
    D.ok(f"sitekit v{KIT_VERSION}", f"pinned to hub {pinned[:7]}" if pinned else "") if pinned else \
        D.bad("site.json has no `kit` (hub commit this copy came from)", "run `sitekit.py setup --update <sha>`", False)

    print("tools")
    need = [{"cmd": "git", "version": ["--version"], "fix": "install git (Xcode Command Line Tools / apt)"}]
    if any(CONF["state"].get(k) for k in ("state_db", "raw_db")) or CONF["state"]["warm"]:
        need.append({"cmd": "age", "version": ["--version"], "fix": "brew install age  (Linux: apt install age)"})
    for t in need + CONF["tools"]:
        exe = shutil.which(t["cmd"])
        if not exe:
            D.bad(f"{t['cmd']} missing", t.get("fix", f"install {t['cmd']}"), t.get("required", True))
            continue
        v = subprocess.run([exe, *t.get("version", ["--version"])], text=True, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT).stdout.strip().splitlines()
        v = v[0] if v else ""
        if t.get("match") and not re.search(t["match"], v):
            D.bad(f"{t['cmd']}: {v}", t.get("fix", f"need {t['match']}"), t.get("required", True))
        else:
            D.ok(t["cmd"], v[:60])

    print("secrets")
    for s in CONF["secrets"]:
        used_here = not s.get("jobs") or any(j["name"] in s["jobs"] for j in here)
        if s.get("where") == "actions":
            D.ok(f"{s['name']} (GitHub Actions secret: not checkable here)")
            continue
        if get_secret(s["name"]) is not None:
            D.ok(s["name"], "present")
        else:
            D.bad(f"{s['name']} missing", s.get("fix", f"Keychain site/{CONF['slug']}/{s['name']}"),
                  required=used_here and s.get("required", True))
    if CONF["state"].get("recipient"):
        key = get_secret(DATA_KEY)
        if key and public_of(key) != CONF["state"]["recipient"]:
            D.bad("state.recipient is not the shared key's public half", "run `sitekit.py keygen` and commit site.json")
        else:
            D.ok("state.recipient", CONF["state"]["recipient"][:16] + "…" + (" = shared key" if key else ""))
    elif any(CONF["state"].get(k) for k in ("state_db", "raw_db")):
        D.bad("no state.recipient in site.json", "run `sitekit.py keygen` once and commit site.json")

    print("state")
    for k in ("raw_db", "state_db"):
        rel = CONF["state"].get(k)
        if rel:
            D.ok(rel, f"{p(rel).stat().st_size / 1e6:.1f} MB") if p(rel).exists() else \
                D.bad(f"{rel} missing", f"run `sitekit.py restore` (needs {DATA_KEY})")
    if any(CONF["state"].get(k) for k in ("state_db", "raw_db")):
        r = subprocess.run(["git", "ls-remote", "origin", "refs/heads/state"], cwd=ROOT, text=True,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if r.returncode != 0:
            D.bad("can't reach origin", "check network / git credentials (`ssh -T git@github.com`)")
        elif not r.stdout.strip():
            D.bad("no `state` branch on origin yet", "run `sitekit.py save` after the first successful run", False)
        else:
            D.ok("`state` branch on origin", r.stdout.split()[0][:7])
            man = branch_dir() / "manifest.json"
            if man.exists():
                m = json.loads(man.read_text())
                total = sum(x.get("bytes", 0) for x in m.get("raw", []))
                if total > 3.5e9:
                    D.bad(f"raw store is {total / 1e9:.1f} GB (repo limit 4 GB)", "plan the move of raw segments to "
                          "Release assets (STANDARD.md §5.3)", required=False)
                else:
                    D.ok("raw store size", f"{total / 1e9:.2f} GB of 4 GB")

    print("jobs")
    s = read_status()
    for j in CONF["jobs"]:
        rec = s["jobs"].get(j["name"], {})
        sa = parse_iso(rec.get("stale_after"))
        where = j.get("runs_on", "mac")
        if where == "actions":  # reported by the hub's publish workflow into the published status.json only
            D.ok(f"{j['name']} (actions)", "status is reported by the publish workflow; see the site's status line")
            continue
        rerun = f"`./run {j['name']}`" if j.get("command") else "ingest new data, then `./run` the job that uses it"
        if rec.get("result") == "failed":
            D.bad(f"{j['name']} ({where}): last run failed at {rec.get('step')}", f"see the job log; then {rerun}",
                  required=False)
        elif sa and now() > sa:
            D.bad(f"{j['name']} ({where}): stale since {iso(sa)}", "the scheduled run didn't happen or didn't push",
                  required=False)
        elif rec.get("last_ok"):
            D.ok(f"{j['name']} ({where})", f"last ok {rec['last_ok']}")
        else:
            D.bad(f"{j['name']} ({where}): no successful run recorded", rerun, False)
    if MAC:
        for j in local_jobs():
            label = f"site.{CONF['slug']}.{j['name']}"
            r = subprocess.run(["launchctl", "print", f"gui/{os.getuid()}/{label}"], stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
            D.ok(f"schedule {label}") if r.returncode == 0 else \
                D.bad(f"schedule {label} not installed", "run `sitekit.py schedule`")

    print("portability")
    hits = []
    for f in git("ls-files").splitlines():
        if f.startswith((".kit/", "docs/")) or f.endswith((".md", ".plist", ".json", ".lock")):
            continue
        try:
            text = (ROOT / f).read_text(errors="ignore")
        except (IsADirectoryError, FileNotFoundError):
            continue
        for pat in ("/System/Library/", "/Users/", "/Library/Application Support", "~/Library/"):
            if pat in text:
                hits.append(f"{f}: {pat}")
    allowed = set(CONF.get("mac_paths_ok", []))
    hits = [h for h in hits if h.split(":")[0] not in allowed]
    D.ok("no macOS-only paths in code") if not hits else D.bad(
        "macOS-only paths: " + "; ".join(hits[:5]) + (" …" if len(hits) > 5 else ""),
        "make `build` work on Linux (fallbacks), or list update-only files in site.json mac_paths_ok", False)

    for c in CONF["checks"]:
        if c.get("on") and c["on"] != ("mac" if MAC else "linux"):
            continue
        if a.quick and c.get("slow"):
            continue
        r = subprocess.run(c["cmd"], shell=True, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        D.ok(c["name"]) if r.returncode == 0 else D.bad(f"{c['name']}: {r.stdout.strip()[-200:]}", c.get("fix", ""),
                                                        c.get("required", True))
    print("fake data")
    if not CONF.get("test"):
        D.bad("site.json has no `test`", "add a command that builds the outputs from committed fake data (§8)")
    elif not a.quick:
        r = subprocess.run(CONF["test"], shell=True, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           text=True, env=clean_env(SITE_TEST="1", SITE_OFFLINE="1"))
        D.ok(CONF["test"]) if r.returncode == 0 else D.bad(f"`{CONF['test']}` failed: {r.stdout.strip()[-300:]}",
                                                           "fix the build or the fake data")
    if CONF.get("build_offline") and not a.quick:
        print("offline build")
        r = subprocess.run(CONF["build_offline"], shell=True, cwd=ROOT, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, text=True, env=dict(os.environ, SITE_OFFLINE="1"))
        D.ok(CONF["build_offline"]) if r.returncode == 0 else D.bad(
            f"`{CONF['build_offline']}` failed: {r.stdout.strip()[-300:]}", "fix the build; it must run anywhere")

    if CONF.get("manual"):
        print("manual steps (RECOVERY.md; not checkable)")
        for m in CONF["manual"]:
            print(f"  · {m}")
    print(f"\n{'❌ ' + str(D.fail) + ' required item(s) missing' if D.fail else '✅ ready'}"
          f"{f', {D.warn} warning(s)' if D.warn else ''}")
    return D.fail


# ----------------------------------------------------------------------------------------------------------- setup
def cmd_setup(a):
    if a.update:
        with tempfile.TemporaryDirectory() as tmp:
            sh(["git", "clone", "-q", "--filter=blob:none", "--no-checkout", f"https://github.com/{HUB}.git", tmp])
            sh(["git", "fetch", "-q", "origin", a.update], cwd=tmp)  # a branch, tag or full commit sha
            sha = git("rev-parse", "FETCH_HEAD", cwd=tmp)
            sh(["git", "checkout", "-q", sha, "--", "kit/sitekit.py"], cwd=tmp)
            (ROOT / ".kit").mkdir(exist_ok=True)
            shutil.copy2(Path(tmp) / "kit" / "sitekit.py", ROOT / ".kit" / "sitekit.py")
        conf = json.loads((ROOT / "site.json").read_text())
        conf["kit"] = sha
        (ROOT / "site.json").write_text(json.dumps(conf, indent=2) + "\n")
        print(f"kit updated to hub {sha[:7]}: review and commit .kit/sitekit.py and site.json")
        return
    print("setup commands")
    for c in CONF["setup"]:
        sh(c)
    st = CONF["state"]
    if any(st.get(k) for k in ("raw_db", "state_db")):
        missing = [x for x in (st["raw_db"], st["state_db"]) if x and not p(x).exists()]
        if missing:
            if identity_keys():
                print("restore")
                cmd_restore(argparse.Namespace(force=False))
            else:
                print(f"state missing ({', '.join(missing)}) and no {DATA_KEY}: set it, then rerun setup")
    if local_jobs() and not a.no_schedule:
        print("schedules")
        cmd_schedule()
    print()
    sys.exit(1 if cmd_doctor(argparse.Namespace(quick=False)) else 0)


def cmd_recovery(a=None):
    slug, st = CONF["slug"], CONF["state"]
    has_state = any(st.get(k) for k in ("raw_db", "state_db")) or st["warm"]
    L = [f"# Recovering {slug}", "",
         "Generated by `python3 .kit/sitekit.py recovery` from `site.json`; edit site.json, not this file.", "",
         "## On a new machine", "",
         "1. Clone into the shared parent directory:",
         f"   `git clone git@github.com:{CONF.get('repo', 'juanjoneri/' + slug)}.git ~/Code/{slug} && cd ~/Code/{slug}`"]
    n = 2
    if CONF.get("manual"):
        L.append(f"{n}. Manual steps (no script can do these):")
        L += [f"   - {m}" for m in CONF["manual"]]
        n += 1
    keychain = [s for s in CONF["secrets"] if s.get("where", "keychain") == "keychain"]
    if keychain or has_state:
        L.append(f"{n}. Secrets: copy each from the password manager into the Keychain "
                 "(`security add-generic-password -s <service> -a \"$USER\" -w`; it prompts for the value):")
        for s in keychain:
            L.append(f"   - `site/{slug}/{s['name']}` ← password manager `{slug} / {s['name']}`"
                     + (f" ({s['fix']})" if s.get("fix") else ""))
        if has_state:
            L.append(f"   - `site/{DATA_KEY}` ← password manager `{DATA_KEY}` (the shared data key of every project; "
                     "needed to restore the state)")
        n += 1
    does = ["runs the setup commands"] + (["restores the state from the `state` branch"] if has_state else []) + \
        (["installs the schedules"] if local_jobs() else []) + ["runs `./doctor`"]
    L.append(f"{n}. `./setup`: {', '.join(does[:-1])} and {does[-1]}. Repeat until doctor shows ✅ ready.")
    n += 1
    proof = f"`{CONF['build_offline']}`" if CONF.get("build_offline") else "`./run <job> --offline`"
    L += [f"{n}. Prove it: {proof} must build the same output as before, offline (the acceptance test).", "",
          "## Cloud sessions (no Mac)", "",
          f"- Fake data, no key: `python3 .kit/sitekit.py test` (`{CONF.get('test', 'site.json test')}`).",
          f"- Real data: with `{DATA_KEY}` in the environment, `./setup` restores the state; "
          + (f"`{CONF['build_offline']}` rebuilds the outputs." if CONF.get("build_offline") else "then run offline."),
          "- Code pushed to `main` runs on the Mac at its next scheduled run, if `test` passes (STANDARD.md §6.5).", ""]
    gh = [s for s in CONF["secrets"] if s.get("where") == "actions"]
    if gh:
        L += ["## GitHub Actions secrets (repo Settings → Secrets → Actions)", ""]
        L += [f"- `{s['name']}`" + (f": {s['fix']}" if s.get("fix") else "") for s in gh] + [""]
    L += ["## Jobs", "", "| job | runs on | schedule | freshness |", "|---|---|---|---|"]
    for j in CONF["jobs"]:
        sched = "; ".join(f"`{e['cron']}` {e.get('tz', 'UTC')}" for e in j.get("schedule", [])) or "on demand"
        f = j.get("freshness", {})
        fr = f"reminder after {f.get('every_days', 30)} days" if f.get("mode") == "reminder" else \
            f"alert {f.get('grace_minutes', 90)} min after a missed run"
        L.append(f"| {j['name']} | {j.get('runs_on', 'mac')} | {sched} | {fr} |")
    L += ["", "## Tools", ""]
    L += [f"- `{t['cmd']}`" + (f" ({t['match']})" if t.get("match") else "") + (f": {t['fix']}" if t.get("fix") else "")
          for t in [{"cmd": "git"}] + ([{"cmd": "age", "fix": "brew install age"}] if has_state else []) + CONF["tools"]]
    (ROOT / "RECOVERY.md").write_text("\n".join(L) + "\n")
    print("wrote RECOVERY.md")


def cmd_secret(a):
    v = get_secret(a.name)
    if v is None:
        sys.exit(1)
    sys.stdout.write(v)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("setup"); s.add_argument("--update", metavar="HUB_REF"); s.add_argument("--no-schedule", action="store_true")
    s = sub.add_parser("doctor"); s.add_argument("--quick", action="store_true")
    s = sub.add_parser("run"); s.add_argument("job"); s.add_argument("--offline", action="store_true"); s.add_argument("--no-push", action="store_true")
    s.add_argument("--no-update", action="store_true", help="don't pull code from GitHub first")
    sub.add_parser("test"); sub.add_parser("rekey")
    s = sub.add_parser("ingest"); s.add_argument("source"); s.add_argument("paths", nargs="+")
    s.add_argument("--prefix", default=""); s.add_argument("--meta")
    s = sub.add_parser("save"); s.add_argument("--warm", action="store_true")
    s = sub.add_parser("restore"); s.add_argument("--force", action="store_true")
    s = sub.add_parser("report"); s.add_argument("job"); s.add_argument("--ok", action="store_true")
    s.add_argument("--fail", metavar="STEP"); s.add_argument("--code", type=int)
    s = sub.add_parser("keygen"); s.add_argument("--new", action="store_true")
    sub.add_parser("schedule")
    s = sub.add_parser("secret"); s.add_argument("name")
    s = sub.add_parser("due"); s.add_argument("job"); s.add_argument("--after")
    sub.add_parser("recovery")
    a = ap.parse_args()
    load()
    fn = {"setup": cmd_setup, "doctor": lambda a: sys.exit(1 if cmd_doctor(a) else 0), "run": cmd_run,
          "ingest": cmd_ingest, "save": cmd_save, "restore": cmd_restore, "report": cmd_report, "keygen": cmd_keygen,
          "schedule": cmd_schedule, "secret": cmd_secret, "due": cmd_due, "recovery": cmd_recovery,
          "test": cmd_test, "rekey": cmd_rekey}[a.cmd]
    fn(a)


if __name__ == "__main__":
    main()
