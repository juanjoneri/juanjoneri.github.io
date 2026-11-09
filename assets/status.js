/* Reporting (STANDARD.md §7). Evaluated against the viewer's clock, so a job that silently stopped shows up without
   anything being redeployed.
   - Landing page (public): <script id="site-status" type="application/json"> holds each site's summary
     {failed, ok_until}. The [data-status-slug] span after the site's name shows a warning sign when the site needs
     attention; nothing otherwise.
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
        (lastOk ? " · last ok " + when(j.last_ok) : "") + (j.rev ? " · code " + j.rev : "") };
    }
    if (!lastOk) return { level: "unknown", text: name + ": no successful run yet" };
    if (stale && now > stale) {
      if (j.mode === "reminder") return { level: "reminder", text: name + ": no new data for " + ago(now - lastOk) };
      return { level: "stale", text: name + ": stale, last ok " + when(j.last_ok) + " (" + ago(now - lastOk) + " ago)" };
    }
    return { level: "ok", text: name + ": ok · " + ago(now - lastOk) + " ago" + (j.rev ? " · code " + j.rev : "") };
  }

  function landing() {
    var data = document.getElementById("site-status");
    if (!data) return;
    var all = JSON.parse(data.textContent || "{}");
    var now = Date.now();
    document.querySelectorAll("[data-status-slug]").forEach(function (el) {
      var s = all[el.getAttribute("data-status-slug")];
      var warn = !!s && (s.failed || (s.ok_until && now > Date.parse(s.ok_until)));
      el.textContent = warn ? " " + ICON.stale : "";
      el.title = warn ? "needs attention: open the site for details" : "";
      el.setAttribute("aria-label", warn ? "needs attention" : "");
    });
  }

  // Compact: a dot + the age of the newest successful run (or the problem); tap for one line per job.
  function pages() {
    var data = document.getElementById("site-status-data");
    document.querySelectorAll("[data-site-status]").forEach(function (el) {
      var status = data ? JSON.parse(data.textContent || "{}") : null;
      var jobs = (status && status.jobs) || {};
      var now = Date.now();
      var names = Object.keys(jobs).sort();
      var rs = names.map(function (k) { return judge(k, jobs[k], now); });
      var worst = rs.reduce(function (a, r) { return RANK[r.level] > RANK[a] ? r.level : a; }, "ok");
      if (!rs.length) worst = "unknown";
      var newest = names.reduce(function (a, k) { var t = Date.parse(jobs[k].last_ok || 0) || 0; return t > a ? t : a; }, 0);
      var short = !rs.length ? "no status" : worst === "ok" ? ago(now - newest) :
        rs.filter(function (r) { return r.level === worst; }).length + " " + worst;
      var open = el.querySelector(".details") && !el.querySelector(".details").hidden;
      el.textContent = "";
      el.className = "site-status status-" + worst;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ui-status status-" + worst + ((worst === "stale" || worst === "failed") && !el.dataset.pulsed ? " pulse" : "");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.title = "job status";
      var dot = document.createElement("span"); dot.className = "ui-dot";
      var t = document.createElement("span"); t.className = "t"; t.textContent = short;
      btn.appendChild(dot); btn.appendChild(t);
      el.dataset.pulsed = "1";
      var det = document.createElement("div");
      det.className = "details"; det.hidden = !open;
      rs.forEach(function (r) {
        var line = document.createElement("div");
        line.className = "status-" + r.level;
        line.textContent = ICON[r.level] + " " + r.text;
        det.appendChild(line);
      });
      btn.addEventListener("click", function () { det.hidden = !det.hidden; btn.setAttribute("aria-expanded", det.hidden ? "false" : "true"); });
      if (!el.dataset.outside) {  // a tap anywhere else closes the details
        el.dataset.outside = "1";
        document.addEventListener("pointerdown", function (e) {
          var d = el.querySelector(".details"), b = el.querySelector(".ui-status");
          if (d && !el.contains(e.target)) { d.hidden = true; if (b) b.setAttribute("aria-expanded", "false"); }
        });
      }
      el.appendChild(btn);
      if (rs.length) el.appendChild(det);
    });
  }

  function render() { landing(); pages(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render); else render();
  setInterval(render, 60000);
})();
