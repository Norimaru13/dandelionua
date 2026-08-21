document.addEventListener("DOMContentLoaded", function () {
  var clickSrc = "assets/minecraft_click.mp3";
  var clickAudio = new Audio(clickSrc);
  clickAudio.preload = "auto";
  var lastClickAt = 0;
  window.dandelionClick = function () {
    var now = Date.now();
    if (now - lastClickAt < 120) return;
    lastClickAt = now;
    try {
      var a = clickAudio.cloneNode();
      a.play().catch(function () {});
    } catch (err) {}
  };
  document.addEventListener("click", function (e) {
    var hit = e.target.closest(
      "button, a[href], summary, .side-slot, .proj-chip, .post-swatch, .rgb-pick, [role=button], input[type=checkbox], input[type=radio], input[type=file], input[type=submit], input[type=button]"
    );
    if (!hit) return;
    if (hit.closest("[contenteditable=true], textarea, input[type=text], input[type=password], input[type=url], input[type=search]")) return;
    window.dandelionClick();
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
  var scrollEnd = document.querySelector("[data-scroll-end]");
  var pane = document.querySelector(".site-pane");
  if (scroller && rail && thumb) {
    var dragging = false;
    var dragY = 0;
    var dragTop = 0;

    function endOverlap() {
      if (!scrollEnd || !pane) return 0;
      var er = scrollEnd.getBoundingClientRect();
      var pr = pane.getBoundingClientRect();
      var overlap = Math.min(pr.bottom, er.bottom) - Math.max(pr.top, er.top);
      return overlap > 0 ? overlap + 1 : 0;
    }

    function metrics() {
      var overlap = endOverlap();
      var view = scroller.clientHeight;
      var track = Math.max(view - overlap, 0);
      var full = scroller.scrollHeight;
      var maxScroll = Math.max(full - view, 0);
      var thumbH = maxScroll === 0 ? 0 : Math.max((track / full) * track, 48);
      if (thumbH > track) thumbH = track;
      return {
        view: view,
        track: track,
        maxScroll: maxScroll,
        thumbH: thumbH,
        maxTop: Math.max(track - thumbH, 0)
      };
    }

    function syncThumb() {
      var overlap = endOverlap();
      rail.style.bottom = overlap + "px";
      var m = metrics();
      if (m.maxScroll === 0) {
        thumb.style.display = "none";
        return;
      }
      thumb.style.display = "block";
      thumb.style.height = m.thumbH + "px";
      thumb.style.top = m.maxTop === 0 ? "0px" : (scroller.scrollTop / m.maxScroll) * m.maxTop + "px";
    }

    scroller.addEventListener("scroll", syncThumb);
    window.addEventListener("resize", syncThumb);
    if (window.ResizeObserver) {
      new ResizeObserver(syncThumb).observe(scroller);
      if (scroller.firstElementChild) new ResizeObserver(syncThumb).observe(scroller.firstElementChild);
      if (scrollEnd) new ResizeObserver(syncThumb).observe(scrollEnd);
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

  var flowerSrcs = [
    "assets/icons/dandelion.png",
    "assets/icons/dandelion_puff.png",
    "assets/icons/golden_dandelion.png",
    "assets/icons/poppy.png",
    "assets/icons/pink_poppy.png",
    "assets/icons/golden_poppy.png"
  ];
  var flowerBtn = document.querySelector("[data-footer-flower]");
  var flowerImg = flowerBtn ? flowerBtn.querySelector("img") : null;
  var flowerIndex = 0;
  var flowerStreak = 0;
  var flowerLast = 0;
  var flowerEggTimer = 0;
  var flowerEggAudio = null;
  var FLOWER_BTN = 32;
  var FLOWER_MAX = FLOWER_BTN * 3;

  function clearFlowerEgg() {
    window.clearTimeout(flowerEggTimer);
    flowerEggTimer = 0;
    if (flowerEggAudio) {
      try { flowerEggAudio.pause(); } catch (err) {}
      flowerEggAudio = null;
    }
    var layer = document.querySelector(".flower-burst");
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
  }

  function fireFlowerEgg() {
    clearFlowerEgg();
    var layer = document.createElement("div");
    layer.className = "flower-burst";
    var gif = document.createElement("img");
    gif.className = "flower-gif";
    gif.src = "assets/rick roll gif.gif";
    gif.alt = "";
    layer.appendChild(gif);
    var n = 64;
    var i;
    for (i = 0; i < n; i += 1) {
      var bit = document.createElement("img");
      bit.className = "flower-bit";
      bit.src = flowerSrcs[Math.floor(Math.random() * flowerSrcs.length)];
      bit.alt = "";
      var size = FLOWER_BTN + Math.random() * (FLOWER_MAX - FLOWER_BTN);
      var x0 = Math.random() * window.innerWidth;
      var y0 = Math.random() * window.innerHeight;
      var x1 = (Math.random() < 0.5 ? -1 : 1) * (window.innerWidth + size);
      var y1 = (Math.random() - 0.5) * window.innerHeight * 2;
      bit.style.width = size + "px";
      bit.style.height = size + "px";
      bit.style.transform = "translate(" + x0 + "px, " + y0 + "px) rotate(0deg)";
      layer.appendChild(bit);
      (function (el, dx, dy, rot, ms) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            el.style.transition = "transform " + ms + "ms linear, opacity " + ms + "ms linear";
            el.style.transform = "translate(" + dx + "px, " + dy + "px) rotate(" + rot + "deg)";
            el.style.opacity = "0.2";
          });
        });
      })(bit, x0 + x1, y0 + y1, (Math.random() * 720 - 360), 3500 + Math.random() * 2500);
    }
    document.body.appendChild(layer);
    flowerEggAudio = new Audio("assets/rick-rolled-sound.mp3");
    flowerEggAudio.play().catch(function () {});
    flowerEggTimer = window.setTimeout(clearFlowerEgg, 6000);
  }

  if (flowerBtn && flowerImg) {
    flowerBtn.addEventListener("click", function () {
      flowerIndex = (flowerIndex + 1) % flowerSrcs.length;
      flowerImg.src = flowerSrcs[flowerIndex];
      var now = Date.now();
      if (flowerLast && now - flowerLast > 400) flowerStreak = 1;
      else flowerStreak += 1;
      flowerLast = now;
      if (flowerStreak >= 18) {
        flowerStreak = 0;
        fireFlowerEgg();
      }
    });
  }

  var footLine = document.querySelector(".site-footer p");
  var footHits = 0;
  var footHitAt = 0;
  var footBox = null;
  var footLock = "1b216ed9392903d591d7e3c4c23fb7075260e1448d187be06b0c6f63e90e0739";
  var footPack = "cbbbbe67e8acd3654059c31540ef02d7e3b05468adc8c730d5dde0433994d781caa7bf55e993d365";

  function footGlyph(e) {
    var node = null;
    var off = 0;
    if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        node = pos.offsetNode;
        off = pos.offset;
      }
    } else if (document.caretRangeFromPoint) {
      var range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        node = range.startContainer;
        off = range.startOffset;
      }
    }
    if (!node || node.nodeType !== 3) return "";
    var text = node.nodeValue || "";
    return (off > 0 ? text.charAt(off - 1) : "") + (off < text.length ? text.charAt(off) : "");
  }

  function footHex(buf) {
    var u8 = new Uint8Array(buf);
    var out = "";
    var i;
    for (i = 0; i < u8.length; i += 1) out += ("0" + u8[i].toString(16)).slice(-2);
    return out;
  }

  function footOpen() {
    if (footBox) return;
    footBox = document.createElement("div");
    footBox.className = "confirm-modal is-open";
    footBox.innerHTML =
      '<div class="confirm-dialog">' +
        '<input type="text" autocomplete="off" spellcheck="false">' +
        '<div class="confirm-actions">' +
          '<button type="button"><img class="mark" src="assets/icons/yes_icon.png" alt=""></button>' +
        "</div>" +
      "</div>";
    var field = footBox.querySelector("input");
    var ok = footBox.querySelector("button");
    function footTry() {
      var raw = field.value || "";
      if (!window.crypto || !crypto.subtle) return;
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)).then(function (buf) {
        if (footHex(buf) !== footLock) return;
        var key = new Uint8Array(buf);
        var msg = [];
        var i;
        for (i = 0; i < footPack.length; i += 2) {
          msg.push(parseInt(footPack.substr(i, 2), 16) ^ key[(i / 2) % key.length]);
        }
        var line = new TextDecoder().decode(new Uint8Array(msg));
        var pane = footBox.querySelector(".confirm-dialog");
        pane.innerHTML = "<p></p><p>\u2665</p>";
        pane.querySelector("p").textContent = line;
      });
    }
    ok.addEventListener("click", footTry);
    field.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        footTry();
      }
    });
    footBox.addEventListener("click", function (e) {
      if (e.target === footBox) {
        if (footBox.parentNode) footBox.parentNode.removeChild(footBox);
        footBox = null;
      }
    });
    document.body.appendChild(footBox);
    window.requestAnimationFrame(function () {
      field.focus();
    });
  }

  if (footLine) {
    footLine.addEventListener("click", function (e) {
      if (!/[mMмМ]/.test(footGlyph(e))) {
        footHits = 0;
        return;
      }
      var now = Date.now();
      if (footHitAt && now - footHitAt > 500) footHits = 1;
      else footHits += 1;
      footHitAt = now;
      if (footHits >= 3) {
        footHits = 0;
        footOpen();
      }
    });
  }
});
