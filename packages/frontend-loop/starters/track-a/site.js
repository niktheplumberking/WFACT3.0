/* WFACT Track A starter v1: the only script on the site (well under the 50 KB budget). Inlined by
   src/trackA/render.ts. Two jobs: the phone menu, and the request form's validation and status. The form
   handler is not connected yet (a later step wires it); until then it says so plainly and sends nothing. */
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
    if (status) status.textContent = form.getAttribute("data-unconnected");
  });
})();
