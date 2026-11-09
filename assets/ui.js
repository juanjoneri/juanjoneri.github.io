/* juanjoneri.github.io — shared UI behaviour (no dependencies). <script src="/assets/ui.js"></script>
   Everything is opt-in through data attributes, and pages still work without it.

   Tabs        <div class="pill-row" data-tabs="main">
                 <button class="btn" data-tab="week">Week</button> …
               </div>
               <section data-panel="week">…</section> …
               Selected tab gets .on; panels toggle `hidden`; the tab is kept in the URL (#week) so refresh and bookmarks
               reopen it; swipe left/right on the panels switches tabs; the selected pill scrolls into view.
   Choice      <div class="pill-row" data-choice="range"> <button class="btn on" data-value="1y">1y</button> … </div>
               One selected at a time; fires `choice` on the row with detail {name, value}.
   Expand all  <button class="btn" data-expand-all="#list">expand all</button>  toggles every <details> inside #list.
   Scrubbing   <svg viewBox="0 0 300 46" data-scrub='[[x,y,"label"],…]'> (x,y in viewBox units)
               + <div data-scrub-label="same-id-as-svg"></div>. Drag across the chart to read values; vertical
               scrolling keeps working (touch-action: pan-y). Tap to pin.  */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- tabs
  function initTabs(row) {
    var tabs = [].slice.call(row.querySelectorAll("[data-tab]"));
    if (!tabs.length) return;
    function panel(id) { return document.querySelector('[data-panel="' + id + '"]'); }
    function show(id, push) {
      var t = tabs.filter(function (x) { return x.getAttribute("data-tab") === id; })[0] || tabs[0];
      id = t.getAttribute("data-tab");
      tabs.forEach(function (x) {
        var on = x === t;
        x.classList.toggle("on", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
        var p = panel(x.getAttribute("data-tab"));
        if (p) {
          if (on && p.hidden && !reduce) { p.classList.remove("enter"); void p.offsetWidth; p.classList.add("enter"); }
          p.hidden = !on;
        }
      });
      if (t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" });
      if (push) history.replaceState(null, "", "#" + id);
    }
    row.setAttribute("role", "tablist");
    tabs.forEach(function (t) {
      t.setAttribute("role", "tab");
      t.addEventListener("click", function () { show(t.getAttribute("data-tab"), true); });
    });
    // follow the URL: back/forward and links to #tab switch tabs too
    window.addEventListener("hashchange", function () {
      var h = (location.hash || "").slice(1);
      if (tabs.some(function (t) { return t.getAttribute("data-tab") === h; })) show(h, false);
    });
    var start = (location.hash || "").slice(1);
    show(tabs.some(function (t) { return t.getAttribute("data-tab") === start; }) ? start : (row.querySelector(".on") || tabs[0]).getAttribute("data-tab"), false);

    // swipe between panels (horizontal, decisive, not inside a sideways-scrolling element)
    var x0, y0, t0;
    var area = panel(tabs[0].getAttribute("data-tab"));
    area = area && area.parentElement;
    if (!area) return;
    area.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1 || e.target.closest(".pill-row, .scroll-x, svg[data-scrub], input")) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    area.addEventListener("touchend", function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy) || Date.now() - t0 > 600) return;
      var i = tabs.indexOf(row.querySelector(".on"));
      var next = tabs[i + (dx < 0 ? 1 : -1)];
      if (next) show(next.getAttribute("data-tab"), true);
    }, { passive: true });
  }

  // ---------------------------------------------------------------- single choice
  function initChoice(row) {
    row.addEventListener("click", function (e) {
      var b = e.target.closest("[data-value]");
      if (!b || !row.contains(b)) return;
      row.querySelectorAll("[data-value]").forEach(function (x) {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      row.dispatchEvent(new CustomEvent("choice", { bubbles: true, detail: { name: row.getAttribute("data-choice"), value: b.getAttribute("data-value") } }));
    });
  }

  // ---------------------------------------------------------------- expand all
  function initExpandAll(btn) {
    var label = btn.textContent;
    btn.addEventListener("click", function () {
      var scope = document.querySelector(btn.getAttribute("data-expand-all")) || document;
      var all = scope.querySelectorAll("details");
      var open = [].some.call(all, function (d) { return !d.open; });
      all.forEach(function (d) { d.open = open; });
      btn.textContent = open ? "collapse all" : label;
      btn.setAttribute("aria-pressed", open ? "true" : "false");
    });
  }

  // ---------------------------------------------------------------- chart scrubbing
  var NS = "http://www.w3.org/2000/svg";
  function initScrub(svg) {
    var pts;
    try { pts = JSON.parse(svg.getAttribute("data-scrub")); } catch (e) { return; }
    if (!pts || !pts.length) return;
    var vb = svg.viewBox.baseVal;
    var label = document.querySelector('[data-scrub-label="' + svg.id + '"]') || svg.nextElementSibling;
    var idle = label ? label.textContent : "";
    var line = document.createElementNS(NS, "line"), dot = document.createElementNS(NS, "circle");
    line.setAttribute("class", "scrub-line"); line.setAttribute("y1", vb.y); line.setAttribute("y2", vb.y + vb.height);
    line.setAttribute("vector-effect", "non-scaling-stroke");
    dot.setAttribute("class", "scrub-dot"); dot.setAttribute("r", 3);
    var g = document.createElementNS(NS, "g"); g.style.display = "none"; g.appendChild(line); g.appendChild(dot); svg.appendChild(g);
    var pinned = false, active = false;
    function at(clientX) {
      var r = svg.getBoundingClientRect();
      var x = vb.x + (clientX - r.left) / r.width * vb.width, best = pts[0];
      pts.forEach(function (p) { if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; });
      line.setAttribute("x1", best[0]); line.setAttribute("x2", best[0]);
      dot.setAttribute("cx", best[0]); dot.setAttribute("cy", best[1]);
      g.style.display = "";
      if (label) label.textContent = best[2] != null ? best[2] : "";
    }
    function clear() { if (pinned) return; g.style.display = "none"; if (label) label.textContent = idle; }
    svg.addEventListener("pointerdown", function (e) { active = true; pinned = false; at(e.clientX); });
    svg.addEventListener("pointermove", function (e) { if (active || e.pointerType === "mouse") at(e.clientX); });
    svg.addEventListener("pointerup", function (e) { active = false; if (e.pointerType !== "mouse") pinned = true; });
    svg.addEventListener("pointercancel", function () { active = false; clear(); });  // the page scrolled vertically
    svg.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") clear(); });
    document.addEventListener("pointerdown", function (e) { if (!svg.contains(e.target)) { pinned = false; clear(); } });
  }

  function init() {
    document.querySelectorAll("[data-tabs]").forEach(initTabs);
    document.querySelectorAll("[data-choice]").forEach(initChoice);
    document.querySelectorAll("[data-expand-all]").forEach(initExpandAll);
    document.querySelectorAll("svg[data-scrub]").forEach(initScrub);
  }
  window.UI = { init: init, scrub: initScrub };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
