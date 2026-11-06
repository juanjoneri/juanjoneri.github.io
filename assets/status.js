/* Reporting (STANDARD.md §7). Evaluated against the viewer's clock, so a job that silently stopped shows up without
   anything being redeployed.
   - Landing page (public): <script id="site-status" type="application/json"> holds each site's summary
     {failed, ok_until}. A cell [data-status-slug] shows a warning sign when the site needs attention; nothing else.
   - Project pages (encrypted): publish embeds the full status as <script id="site-status-data"> next to
     <div data-site-status="<slug>"></div>; this script renders one line per job there. Details never leave the
     encrypted page. */
(function () {
  var ICON = { ok: "✅", stale: "⚠️", failed: "❌", reminder: "⏳", unknown: "·" };
  var RANK = { failed: 4, stale: 3, reminder: 2, unknown: 1, ok: 0 };
  function ago(ms) {
    var m = Math.round(ms / 60000);
    if (m < 60) return m + "m";
    var h = Math.round(m / 60);
    if (h < 48) return h + "h";
    return Math.round(h / 24) + "d";
  }
  function when(iso) {
    return new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function judge(name, j, now) {
    var lastOk = j.last_ok ? Date.parse(j.last_ok) : null;
    var stale = j.stale_after ? Date.parse(j.stale_after) : null;
    if (j.result === "failed") {
      return { level: "failed", text: name + ": failed at " + (j.step || "?") + " " + ago(now - Date.parse(j.last_run)) + " ago" +
        (lastOk ? " · last ok " + when(j.last_ok) : "") };
    }
    if (!lastOk) return { level: "unknown", text: name + ": no successful run yet" };
    if (stale && now > stale) {
      if (j.mode === "reminder") return { level: "reminder", text: name + ": no new data for " + ago(now - lastOk) };
      return { level: "stale", text: name + ": stale, last ok " + when(j.last_ok) + " (" + ago(now - lastOk) + " ago)" };
    }
    return { level: "ok", text: name + ": ok · " + ago(now - lastOk) + " ago" };
  }

  function landing() {
    var data = document.getElementById("site-status");
    if (!data) return;
    var all = JSON.parse(data.textContent || "{}");
    var now = Date.now();
    document.querySelectorAll("[data-status-slug]").forEach(function (td) {
      var s = all[td.getAttribute("data-status-slug")];
      var warn = !!s && (s.failed || (s.ok_until && now > Date.parse(s.ok_until)));
      td.textContent = warn ? ICON.stale : "";
      td.title = warn ? "needs attention: open the site for details" : "";
      td.className = "num" + (warn ? " status-stale" : "");
    });
  }

  function pages() {
    var data = document.getElementById("site-status-data");
    document.querySelectorAll("[data-site-status]").forEach(function (el) {
      var status = data ? JSON.parse(data.textContent || "{}") : null;
      var jobs = (status && status.jobs) || {};
      var now = Date.now();
      var rs = Object.keys(jobs).sort().map(function (k) { return judge(k, jobs[k], now); });
      var worst = rs.reduce(function (a, r) { return RANK[r.level] > RANK[a] ? r.level : a; }, "ok");
      el.textContent = "";
      el.className = "site-status status-" + (rs.length ? worst : "unknown");
      if (!rs.length) { el.textContent = ICON.unknown + " no status reported"; return; }
      rs.forEach(function (r) {
        var line = document.createElement("div");
        line.className = "status-" + r.level;
        line.textContent = ICON[r.level] + " " + r.text;
        el.appendChild(line);
      });
    });
  }

  function render() { landing(); pages(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render); else render();
  setInterval(render, 60000);
})();
