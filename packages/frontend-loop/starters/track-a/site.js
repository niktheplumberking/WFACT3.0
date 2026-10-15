/* WFACT Track A starter: the only script on the site (well under the 50 KB budget). Inlined by
   src/trackA/render.ts. Two jobs: the phone menu, and the request form's validation and sending. A connected form
   (data-endpoint, Step 25) is sent to its action with fetch as JSON, with how long the page was open before sending, on
   the visitor's own clock (the endpoint drops forms sent faster than a person can type). A form with no endpoint says plainly it is not connected and sends nothing. */
(function () {
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("open", open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("open");
        toggle.focus();
      }
    });
  }

  var form = document.querySelector("form[data-request]");
  if (!form) return;
  var status = form.querySelector(".form-status");
  var loadedAt = Date.now();
  var say = function (text) {
    if (status) status.textContent = text;
  };
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var first = null;
    form.querySelectorAll("[required]").forEach(function (input) {
      var error = document.getElementById(input.id + "-error");
      var bad = !input.value.trim();
      input.setAttribute("aria-invalid", String(bad));
      if (error) error.textContent = bad ? error.getAttribute("data-message") : "";
      if (bad && !first) first = input;
    });
    if (first) {
      first.focus();
      return;
    }
    if (!form.hasAttribute("data-endpoint")) {
      say(form.getAttribute("data-unconnected"));
      return;
    }
    var button = form.querySelector('button[type="submit"]');
    var body = {};
    new FormData(form).forEach(function (value, key) {
      body[key] = String(value);
    });
    body.fill_ms = String(Date.now() - loadedAt);
    if (button) button.disabled = true;
    say("Sending...");
    fetch(form.getAttribute("action"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().then(function (j) {
          return r.ok && j && j.ok === true;
        });
      })
      .then(function (ok) {
        if (ok) form.reset();
        say(form.getAttribute(ok ? "data-sent" : "data-failed"));
      })
      .catch(function () {
        say(form.getAttribute("data-failed"));
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  });
})();
