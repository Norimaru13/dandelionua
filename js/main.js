document.addEventListener("DOMContentLoaded", function () {
  var clickSrc = "assets/minecraft_click.mp3";
  document.addEventListener("click", function (e) {
    if (!e.target.closest("button, .side-slot, .page-nav-menu a")) return;
    var audio = new Audio(clickSrc);
    audio.play().catch(function () {});
  }, true);

  var menuToggle = document.querySelector("[data-menu-toggle]");
  var sideMenu = document.querySelector("[data-side-menu]");
  var langToggle = document.querySelector("[data-lang-toggle]");
  var langMenu = document.querySelector("[data-lang-menu]");
  var pageNavToggle = document.querySelector("[data-page-nav-toggle]");
  var pageNavMenu = document.querySelector("[data-page-nav-menu]");

  function setOpen(el, toggle, open) {
    if (!el) return;
    el.classList.toggle("is-open", open);
    if (toggle) {
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  function closeOtherMenus(except) {
    if (except !== "dandelion") setOpen(sideMenu, menuToggle, false);
    if (except !== "lang") setOpen(langMenu, langToggle, false);
    if (except !== "page") setOpen(pageNavMenu, pageNavToggle, false);
  }

  if (menuToggle && sideMenu) {
    menuToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !sideMenu.classList.contains("is-open");
      closeOtherMenus("dandelion");
      setOpen(sideMenu, menuToggle, open);
    });
  }

  if (langToggle && langMenu) {
    langToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !langMenu.classList.contains("is-open");
      closeOtherMenus("lang");
      setOpen(langMenu, langToggle, open);
    });

    langMenu.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setOpen(langMenu, langToggle, false);
      });
    });
  }

  if (pageNavToggle && pageNavMenu) {
    pageNavToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !pageNavMenu.classList.contains("is-open");
      closeOtherMenus("page");
      setOpen(pageNavMenu, pageNavToggle, open);
    });
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".menu-wrap")) setOpen(sideMenu, menuToggle, false);
    if (!e.target.closest(".lang-switch")) setOpen(langMenu, langToggle, false);
    if (!e.target.closest("[data-page-nav]")) setOpen(pageNavMenu, pageNavToggle, false);
  });

  var tip = document.createElement("div");
  tip.className = "social-tip";
  document.body.appendChild(tip);

  function hideTip() {
    tip.classList.remove("is-on");
  }

  document.querySelectorAll(".side-slot[data-i18n-tip]").forEach(function (el) {
    el.addEventListener("mouseenter", function () {
      tip.textContent = t(el.getAttribute("data-i18n-tip"));
      var r = el.getBoundingClientRect();
      tip.style.left = r.left + r.width / 2 + "px";
      tip.style.top = r.bottom + 8 + "px";
      tip.classList.add("is-on");
    });
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("click", hideTip);
  });
  window.addEventListener("scroll", hideTip, true);

  var versions = document.querySelector("[data-versions]");
  var versionsToggle = document.querySelector("[data-versions-toggle]");
  if (versions && versionsToggle) {
    versionsToggle.addEventListener("click", function () {
      var open = !versions.classList.contains("is-open");
      versions.classList.toggle("is-open", open);
      versionsToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var scroller = document.querySelector("[data-scroll]");
  var rail = document.querySelector("[data-scroll-rail]");
  var thumb = document.querySelector("[data-scroll-thumb]");
  if (scroller && rail && thumb) {
    var dragging = false;
    var dragY = 0;
    var dragTop = 0;

    function metrics() {
      var view = scroller.clientHeight;
      var full = scroller.scrollHeight;
      var maxScroll = Math.max(full - view, 0);
      var thumbH = maxScroll === 0 ? 0 : Math.max((view / full) * view, 48);
      return {
        view: view,
        maxScroll: maxScroll,
        thumbH: thumbH,
        maxTop: view - thumbH
      };
    }

    function syncThumb() {
      var m = metrics();
      if (m.maxScroll === 0) {
        thumb.style.display = "none";
        return;
      }
      thumb.style.display = "block";
      thumb.style.height = m.thumbH + "px";
      thumb.style.top = (scroller.scrollTop / m.maxScroll) * m.maxTop + "px";
    }

    scroller.addEventListener("scroll", syncThumb);
    window.addEventListener("resize", syncThumb);
    if (window.ResizeObserver) {
      new ResizeObserver(syncThumb).observe(scroller);
      if (scroller.firstElementChild) new ResizeObserver(syncThumb).observe(scroller.firstElementChild);
    }

    thumb.addEventListener("mousedown", function (e) {
      e.preventDefault();
      dragging = true;
      dragY = e.clientY;
      dragTop = parseFloat(thumb.style.top || "0");
    });

    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var m = metrics();
      var next = dragTop + (e.clientY - dragY);
      if (next < 0) next = 0;
      if (next > m.maxTop) next = m.maxTop;
      scroller.scrollTop = m.maxTop === 0 ? 0 : (next / m.maxTop) * m.maxScroll;
    });

    document.addEventListener("mouseup", function () {
      dragging = false;
    });

    rail.addEventListener("mousedown", function (e) {
      if (e.target === thumb) return;
      var m = metrics();
      var y = e.clientY - rail.getBoundingClientRect().top - m.thumbH / 2;
      if (y < 0) y = 0;
      if (y > m.maxTop) y = m.maxTop;
      scroller.scrollTop = m.maxTop === 0 ? 0 : (y / m.maxTop) * m.maxScroll;
    });

    if (versionsToggle) {
      versionsToggle.addEventListener("click", function () {
        window.setTimeout(syncThumb, 280);
      });
    }

    syncThumb();
  }
});
