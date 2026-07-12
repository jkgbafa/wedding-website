/* Joshua & Lucia — RSVP page: code lookup, branching, confirm prompt, thank-you.
   Codes are a dummy test for now; the backend will own the real list later. */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  // ---- dummy code → name (replace/extend on the backend later) ----
  var CODES = {
    "1234": "Uncle Kwame",
    "ABC": "Auntie Joyce"
  };

  var stepCode = $("stepCode"), stepForm = $("stepForm"), stepThanks = $("stepThanks");
  var form = $("rsvpForm");

  function showForm(name) {
    if (name) {
      $("greeting").innerHTML = "Hi <b>" + esc(name) + "</b> — Joshua &amp; Lucia are so excited that you've decided to RSVP! " +
        "Please fill in the details below, and let us know if you'll be bringing anyone. We're so grateful for you. 💙";
      $("fName").value = name;
    } else {
      $("greeting").innerHTML = "We're so glad you're here! Please fill in the details below. 💙";
    }
    stepCode.hidden = true;
    stepForm.hidden = false;
    stepForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---- step 1: code entry ----
  $("codeBtn").addEventListener("click", function () {
    var raw = $("codeInput").value.trim();
    if (!raw) { fail("Please type your code, or tap “I don't have an RSVP code” below."); return; }
    var name = CODES[raw] || CODES[raw.toUpperCase()];
    if (!name) { fail("Hmm, we don't recognise that code. Check your invitation, or continue without one."); return; }
    $("fCode").value = raw;
    showForm(name);
  });
  $("codeInput").addEventListener("keydown", function (e) { if (e.key === "Enter") $("codeBtn").click(); });
  $("noCodeBtn").addEventListener("click", function () { $("fCode").value = ""; showForm(""); });

  function fail(msg) {
    var el = $("codeErr"); el.className = "form-status err"; el.textContent = msg;
  }

  // ---- phone hint + guest count (same as main site) ----
  var hints = {
    "+233": "Ghana numbers: you can type it with or without the leading 0.",
    "+1": "US numbers: 10 digits, e.g. 404 555 0123.",
    "other": "Please include your full country code, e.g. +44 7911 123456."
  };
  $("fCountry").addEventListener("change", function () { $("phoneHint").textContent = hints[this.value]; });
  document.querySelectorAll('input[name="attending"]').forEach(function (r) {
    r.addEventListener("change", function () { $("guestsField").hidden = this.value !== "In person"; });
  });

  // ---- submit (with the "are you sure" confirm) ----
  var pendingSubmit = false;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    var attending = (form.querySelector('input[name="attending"]:checked') || {}).value;
    var notify = $("fNotify").checked;

    // Not there in person AND not asking for the live link → nudge once.
    if (!pendingSubmit && attending !== "In person" && !notify) {
      $("confirmModal").hidden = false;
      return;
    }
    pendingSubmit = false;
    doSubmit();
  });

  $("modalNotify").addEventListener("click", function () {
    $("fNotify").checked = true;       // change of mind — recorded in their entry
    $("confirmModal").hidden = true;
    pendingSubmit = true;
    form.requestSubmit ? form.requestSubmit() : doSubmit();
  });
  $("modalProceed").addEventListener("click", function () {
    $("confirmModal").hidden = true;
    pendingSubmit = true;
    form.requestSubmit ? form.requestSubmit() : doSubmit();
  });

  function doSubmit() {
    var btn = $("submitBtn"), statusEl = $("formStatus");
    statusEl.className = "form-status"; statusEl.textContent = "";

    var data = new URLSearchParams(new FormData(form));
    if (!$("fNotify").checked) data.set("notifyLive", "No");
    var name = $("fName").value.trim();
    var contact = (form.querySelector('input[name="preferredContact"]:checked') || {}).value || "email";

    // No backend yet? Still give the guest a proper thank-you (dummy test).
    if (!APPS_SCRIPT_URL) { thankYou(name, contact); return; }

    btn.disabled = true; btn.textContent = "Sending…";
    fetch(APPS_SCRIPT_URL, { method: "POST", body: data })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) { thankYou(name, contact); }
        else { statusEl.className = "form-status err"; statusEl.textContent = (res && res.error) || "Something went wrong — please try again."; }
      })
      .catch(function () {
        // network/config issue — don't lose the guest; show thanks anyway
        thankYou(name, contact);
      })
      .finally(function () { btn.disabled = false; btn.textContent = "Send my RSVP"; });
  }

  function thankYou(name, contact) {
    var how = contact === "SMS" ? "text message" : contact === "WhatsApp" ? "WhatsApp" : "email";
    $("thanksTitle").textContent = "Thank you, " + (name || "friend") + "!";
    $("thanksBody").innerHTML = "Your RSVP is in — Joshua &amp; Lucia can't wait. We'll be in touch by <b>" + esc(how) + "</b> with reminders and, when the day comes, the livestream link.";
    stepForm.hidden = true; stepCode.hidden = true;
    stepThanks.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
})();
