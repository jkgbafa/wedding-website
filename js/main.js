/* Joshua & Lucia — splash, scroll reveals, scrollspy, countdown, live status, RSVP submit */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  // ---------- opening splash ----------
  var splash = $("splash");
  var dismissed = false;
  function dismissSplash() {
    if (dismissed || !splash) return;
    dismissed = true;
    splash.classList.add("leaving");
    setTimeout(function () { splash.classList.add("gone"); }, 1000);
  }
  if (splash) {
    document.body.style.overflow = "hidden";
    var release = function () { document.body.style.overflow = ""; dismissSplash(); };
    setTimeout(release, 2800);                    // auto-reveal
    splash.addEventListener("click", release);    // or tap to skip
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) release();
  }

  // ---------- scroll reveals ----------
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".fade-up").forEach(function (el) { io.observe(el); });

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

  // ---------- phone hint follows country ----------
  var hints = {
    "+233": "Ghana numbers: you can type it with or without the leading 0.",
    "+1": "US numbers: 10 digits, e.g. 404 555 0123.",
    "other": "Please include your full country code, e.g. +44 7911 123456."
  };
  $("fCountry").addEventListener("change", function () {
    $("phoneHint").textContent = hints[this.value];
  });

  // ---------- show guest count only for in-person ----------
  document.querySelectorAll('input[name="attending"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      $("guestsField").hidden = this.value !== "In person";
    });
  });

  // ---------- RSVP submit ----------
  var form = $("rsvpForm");
  var statusEl = $("formStatus");
  var btn = $("submitBtn");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.className = "form-status";
    statusEl.textContent = "";

    if (!form.reportValidity()) return;

    var data = new URLSearchParams(new FormData(form));
    if (!$("fNotify").checked) data.set("notifyLive", "No");

    if (!APPS_SCRIPT_URL) {
      statusEl.className = "form-status err";
      statusEl.textContent = "The RSVP backend isn't connected yet (site owner: paste your Apps Script URL in js/config.js).";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Sending…";

    fetch(APPS_SCRIPT_URL, { method: "POST", body: data })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) {
          statusEl.className = "form-status ok";
          statusEl.textContent = res.updated
            ? "Your RSVP has been updated — thank you! 💙"
            : "Thank you! Your RSVP is in — check your email for a confirmation. 💙";
          form.reset();
          $("guestsField").hidden = true;
        } else {
          statusEl.className = "form-status err";
          statusEl.textContent = res.error || "Something went wrong — please try again.";
        }
      })
      .catch(function () {
        statusEl.className = "form-status err";
        statusEl.textContent = "Couldn't reach the server. Check your connection and try again.";
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Send my RSVP";
      });
  });
})();
