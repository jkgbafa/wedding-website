/* Joshua & Lucia — splash, scroll reveals, scrollspy, countdown, live status, RSVP submit */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  // ---------- nav theme: white over the cover, solid once scrolled past it ----------
  // Uses an IntersectionObserver (not scroll math) so it flips exactly once at the
  // cover's edge — no flicker in the thin transition band.
  var navEl = $("nav");
  var cover = $("home");
  if (cover && "IntersectionObserver" in window) {
    var navIO = new IntersectionObserver(function (entries) {
      navEl.classList.toggle("scrolled", !entries[0].isIntersecting);
    }, { rootMargin: "-66px 0px 0px 0px", threshold: 0 });
    navIO.observe(cover);
  } else {
    navEl.classList.add("scrolled");
  }

  // ---------- scroll reveals (text + background silhouettes) ----------
  // Reveal text per-element, but reveal a section's silhouettes by watching the
  // SECTION — a clip-path "draw" collapses the silhouette's box to zero, which
  // makes IntersectionObserver think it's off-screen and never fire otherwise.
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var t = en.target;
      if (t.classList.contains("has-sil")) {
        t.querySelectorAll(".sil, .sil-svg").forEach(function (s) { s.classList.add("in"); });
      } else {
        t.classList.add("in");
      }
      io.unobserve(t);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".fade-up").forEach(function (el) { io.observe(el); });
  document.querySelectorAll(".has-sil").forEach(function (el) { io.observe(el); });

  // ---------- tap-to-copy (gift numbers) ----------
  document.querySelectorAll(".copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var val = btn.getAttribute("data-copy");
      var done = function () {
        var em = btn.querySelector("em"); var old = em ? em.textContent : "";
        btn.classList.add("copied"); if (em) em.textContent = "copied!";
        setTimeout(function () { btn.classList.remove("copied"); if (em) em.textContent = old; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(done, done);
      } else {
        var t = document.createElement("textarea"); t.value = val; document.body.appendChild(t);
        t.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(t); done();
      }
    });
  });

  // ---------- hanging polaroids: gentle scroll parallax (drift only) ----------
  // Only the margin-hung ones drift; the story row stays put so hover-shake is clean.
  var hangers = Array.prototype.slice.call(document.querySelectorAll(".polaroid.pol-left, .polaroid.pol-right"));
  if (hangers.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var polData = [];
    function measurePolaroids() {
      polData = hangers.map(function (p) {
        var r = p.getBoundingClientRect();
        return { el: p, docTop: r.top + window.scrollY, h: r.height, depth: parseFloat(p.dataset.depth || "0.12") };
      });
      applyDrift();
    }
    var queued = false;
    function applyDrift() {
      var y = window.scrollY, vh = window.innerHeight;
      polData.forEach(function (d) {
        var mid = d.docTop - y + d.h / 2 - vh / 2;
        d.el.style.setProperty("--drift", (-mid * d.depth).toFixed(1) + "px");
      });
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; applyDrift(); });
    }
    measurePolaroids();
    window.addEventListener("load", measurePolaroids);
    window.addEventListener("resize", measurePolaroids);
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---------- scrollspy (highlight nav link for section in view) ----------
  var navLinks = document.querySelectorAll("#navLinks a");
  var sections = [];
  navLinks.forEach(function (a) {
    var sec = document.querySelector(a.getAttribute("href"));
    if (sec) sections.push({ a: a, sec: sec });
  });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      sections.forEach(function (s) {
        var active = s.sec === en.target;
        s.a.classList.toggle("active", active);
        if (active) s.a.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      });
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  sections.forEach(function (s) { spy.observe(s.sec); });

  // ---------- mobile hamburger menu ----------
  var nav = $("nav");
  var burger = $("navBurger");
  burger.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  document.querySelectorAll("#navLinks a").forEach(function (a) {
    a.addEventListener("click", function () {
      nav.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    });
  });

  // ---------- countdown ----------
  var target = new Date(WEDDING_ISO).getTime();
  function tick() {
    var diff = Math.max(0, target - Date.now());
    var d = Math.floor(diff / 86400000);
    var h = Math.floor(diff / 3600000) % 24;
    var m = Math.floor(diff / 60000) % 60;
    var s = Math.floor(diff / 1000) % 60;
    $("cdDays").textContent = d;
    $("cdHours").textContent = String(h).padStart(2, "0");
    $("cdMins").textContent = String(m).padStart(2, "0");
    $("cdSecs").textContent = String(s).padStart(2, "0");
  }
  tick();
  setInterval(tick, 1000);

  // ---------- live status (from backend) ----------
  function checkLive() {
    if (!APPS_SCRIPT_URL) return;
    fetch(APPS_SCRIPT_URL + "?action=config")
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (cfg.isLive && cfg.livestreamUrl) {
          $("liveWaiting").hidden = true;
          $("liveNow").hidden = false;
          $("liveLink").href = cfg.livestreamUrl;
          var banner = $("liveBanner");
          banner.href = cfg.livestreamUrl;
          banner.hidden = false;
        }
      })
      .catch(function () { /* backend unreachable — page still works */ });
  }
  checkLive();
  setInterval(checkLive, 90000); // re-check every 90s (matters on the big day)

})();
