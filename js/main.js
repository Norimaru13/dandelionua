document.addEventListener("DOMContentLoaded", function () {
  var menuToggle = document.querySelector("[data-menu-toggle]");
  var sideMenu = document.querySelector("[data-side-menu]");
  var langToggle = document.querySelector("[data-lang-toggle]");
  var langMenu = document.querySelector("[data-lang-menu]");

  function setOpen(el, toggle, open) {
    if (!el) return;
    el.classList.toggle("is-open", open);
    if (toggle) {
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  if (menuToggle && sideMenu) {
    menuToggle.addEventListener("click", function () {
      var open = !sideMenu.classList.contains("is-open");
      setOpen(sideMenu, menuToggle, open);
      if (open) setOpen(langMenu, langToggle, false);
    });
  }

  if (langToggle && langMenu) {
    langToggle.addEventListener("click", function () {
      var open = !langMenu.classList.contains("is-open");
      setOpen(langMenu, langToggle, open);
      if (open) setOpen(sideMenu, menuToggle, false);
    });

    langMenu.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setOpen(langMenu, langToggle, false);
      });
    });
  }
});
