/**
 * Публікації: список, адмін-меню, лайки і перегляди.
 */
(function () {
  var MAX_PHOTOS = 4;
  var MAX_BYTES = 600000;
  var VISITOR_KEY = "dandelion-visitor";
  var editingId = null;
  var editingWasDraft = false;
  var viewingLive = false;
  var liveSnapshot = null;
  var workSnapshot = null;
  var noticeLock = false;
  var openSnapshot = null;
  var lastPosts = [];
  var feedKind = "project";
  var savedRange = null;
  var linkRange = null;
  var confirmFn = null;
  var closeTimer = 0;
  var previewPhoto = null;
  var lastEdit = null;
  var confirmTimer = 0;
  var fmtState = { bold: false, italic: false, underline: false, strikeThrough: false };
  var skipFmtSync = false;
  var pickH = 120;
  var pickS = 0.45;
  var pickV = 0.25;
  var PROJECT_VERSIONS = [
    "26.2", "26.1.2", "26.1.1", "26.1",
    "1.21.11", "1.21.10", "1.21.9", "1.21.8", "1.21.7", "1.21.6", "1.21.5", "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
    "1.20.6", "1.20.5", "1.20.4", "1.20.3", "1.20.2", "1.20.1", "1.20",
    "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19",
    "1.18.2", "1.18.1", "1.18"
  ];
  var META_TYPES = ["mod", "datapack", "resourcepack"];
  var META_STATES = ["release", "open_beta", "closed_beta"];
  var META_STATUSES = ["ready", "wip", "paused", "planned"];
  var META_PLATFORMS = ["vanilla", "fabric", "neoforge", "forge"];

  function $(sel) {
    return document.querySelector(sel);
  }

  function rpc(name, body) {
    if (typeof window.dandelionRpc === "function") {
      return window.dandelionRpc(name, body);
    }
    return Promise.reject({ error: "fail" });
  }

  function token() {
    return window.DandelionAuth ? window.DandelionAuth.token() : "";
  }

  function isAdmin() {
    return window.DandelionAuth ? window.DandelionAuth.isAdmin() : false;
  }

  function pageKind() {
    var kind = document.body.getAttribute("data-list-kind");
    if (kind === "project" || kind === "publication") return kind;
    return null;
  }

  function activeKind() {
    return pageKind() || feedKind;
  }

  function postKind(post) {
    return post && post.kind === "publication" ? "publication" : "project";
  }

  function postMeta(post) {
    var meta = post && post.meta;
    if (typeof meta === "string") {
      try { meta = JSON.parse(meta); } catch (e) { meta = null; }
    }
    return meta && typeof meta === "object" ? meta : {};
  }

  function isDraftPost(post) {
    if (!post) return false;
    if (post.draft === true || post.draft === 1 || post.draft === "t" || post.draft === "true") return true;
    var meta = postMeta(post);
    return meta.draft === true || meta.draft === 1 || meta.draft === "true";
  }

  function parsePending(post) {
    var raw = post && post.pending;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { return null; }
    }
    if (!raw || typeof raw !== "object") return null;
    if (!Object.keys(raw).length) return null;
    return raw;
  }

  function isPendingPost(post) {
    if (!post || isDraftPost(post)) return false;
    if (post.has_pending === true || post.has_pending === "t" || post.has_pending === "true") return true;
    return Boolean(parsePending(post));
  }

  function formatWhen(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var locale = (typeof getLang === "function" && getLang() === "ua") ? "uk-UA" : "en-GB";
    return d.toLocaleString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function filteredPosts(list) {
    var kind = activeKind();
    var admin = isAdmin();
    var out = (list || []).filter(function (post) {
      if (postKind(post) !== kind) return false;
      if (isDraftPost(post) && !admin) return false;
      return true;
    });
    if (pageKind()) return out;
    return out.slice(0, 3);
  }

  function syncFeedMore() {
    var more = $("[data-feed-more]");
    if (!more) return;
    more.href = activeKind() === "publication" ? "publications.html" : "projects.html";
  }

  function visitorId() {
    var id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function setPostError(code) {
    var el = $("[data-post-error]");
    if (!el) return;
    el.textContent = code ? t("err_" + code) : "";
  }

  function editor(lang) {
    return $('[data-editor="' + lang + '"]');
  }

  function activeEditor() {
    if (lastEdit && document.contains(lastEdit)) return lastEdit;
    var pane = $(".post-pane.is-on");
    if (!pane) return editor("en");
    return pane.querySelector("[data-editor], [data-lead]") || editor("en");
  }

  function setPostLang(lang) {
    var next = lang === "ua" ? "ua" : "en";
    document.querySelectorAll("[data-post-lang]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-post-lang") === next);
    });
    document.querySelectorAll("[data-post-pane]").forEach(function (pane) {
      pane.classList.toggle("is-on", pane.getAttribute("data-post-pane") === next);
    });
    var form = $("[data-post-form]");
    if (form) form.setAttribute("data-form-lang", next);
  }

  function formKind() {
    var form = $("[data-post-form]");
    if (!form || !form.kind) return "project";
    return form.kind.value === "publication" ? "publication" : "project";
  }

  function syncFormKind() {
    var form = $("[data-post-form]");
    if (!form) return;
    var kind = formKind();
    form.setAttribute("data-form-kind", kind);
    if (form.kind) form.kind.value = kind;
    document.querySelectorAll("[data-post-kind]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-post-kind") === kind);
    });
  }

  function fillVersionBoxes() {
    var box = $("[data-proj-versions]");
    if (!box || box.children.length) return;
    PROJECT_VERSIONS.forEach(function (ver) {
      var label = document.createElement("label");
      label.className = "proj-chip";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.name = "proj_version";
      input.value = ver;
      var span = document.createElement("span");
      span.textContent = ver;
      label.appendChild(input);
      label.appendChild(span);
      box.appendChild(label);
    });
  }

  function checkedValues(name) {
    var out = [];
    document.querySelectorAll('input[name="' + name + '"]:checked').forEach(function (el) {
      out.push(el.value);
    });
    return out;
  }

  function setCheckedValues(name, list) {
    var want = {};
    (list || []).forEach(function (v) { want[v] = true; });
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (el) {
      el.checked = Boolean(want[el.value]);
    });
  }

  function radioValue(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  function setRadioValue(name, value) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (el) {
      el.checked = el.value === value;
    });
  }

  function readMeta() {
    return {
      types: checkedValues("proj_type").filter(function (v) { return META_TYPES.indexOf(v) >= 0; }),
      state: META_STATES.indexOf(radioValue("proj_state")) >= 0 ? radioValue("proj_state") : "",
      status: META_STATUSES.indexOf(radioValue("proj_status")) >= 0 ? radioValue("proj_status") : "",
      versions: checkedValues("proj_version").filter(function (v) { return PROJECT_VERSIONS.indexOf(v) >= 0; }),
      platforms: checkedValues("proj_platform").filter(function (v) { return META_PLATFORMS.indexOf(v) >= 0; })
    };
  }

  function writeMeta(meta) {
    meta = meta || {};
    setCheckedValues("proj_type", meta.types);
    setRadioValue("proj_state", meta.state);
    setRadioValue("proj_status", meta.status);
    setCheckedValues("proj_version", meta.versions);
    setCheckedValues("proj_platform", meta.platforms);
  }

  function setPreviewName(name) {
    var el = $("[data-preview-name]");
    if (!el) return;
    el.textContent = name || "";
    el.title = name || "";
  }

  function setPreview(photo) {
    previewPhoto = photo && photo.data ? photo : null;
    var view = $("[data-preview-view]");
    if (view) {
      view.innerHTML = "";
      if (previewPhoto) {
        var img = document.createElement("img");
        img.src = "data:" + previewPhoto.mime + ";base64," + previewPhoto.data;
        img.alt = "";
        view.appendChild(img);
      }
    }
    setPreviewName(previewPhoto && previewPhoto.name ? previewPhoto.name : "");
  }

  function cropSquare(file) {
    return new Promise(function (resolve, reject) {
      if (file.size > MAX_BYTES * 2) {
        reject({ error: "photo_big" });
        return;
      }
      if (["image/jpeg", "image/png", "image/webp", "image/gif"].indexOf(file.type) === -1) {
        reject({ error: "photo_type" });
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var size = Math.min(img.width, img.height);
          if (!size) {
            reject({ error: "fail" });
            return;
          }
          var sx = (img.width - size) / 2;
          var sy = (img.height - size) / 2;
          var canvas = document.createElement("canvas");
          canvas.width = 512;
          canvas.height = 512;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 512, 512);
          var text = canvas.toDataURL("image/jpeg", 0.85);
          var comma = text.indexOf(",");
          resolve({
            mime: "image/jpeg",
            data: comma >= 0 ? text.slice(comma + 1) : text
          });
        };
        img.onerror = function () { reject({ error: "fail" }); };
        img.src = String(reader.result || "");
      };
      reader.onerror = function () { reject({ error: "fail" }); };
      reader.readAsDataURL(file);
    });
  }

  function toHex(n) {
    var h = Number(n).toString(16);
    return h.length < 2 ? "0" + h : h;
  }

  function parseHex(raw) {
    var s = String(raw || "").trim();
    if (s.charAt(0) !== "#") s = "#" + s;
    if (/^#[0-9a-f]{3}$/i.test(s)) {
      return {
        r: parseInt(s.charAt(1) + s.charAt(1), 16),
        g: parseInt(s.charAt(2) + s.charAt(2), 16),
        b: parseInt(s.charAt(3) + s.charAt(3), 16)
      };
    }
    if (/^#[0-9a-f]{6}$/i.test(s)) {
      return {
        r: parseInt(s.slice(1, 3), 16),
        g: parseInt(s.slice(3, 5), 16),
        b: parseInt(s.slice(5, 7), 16)
      };
    }
    return null;
  }

  function metaLine(labelKey, values, map) {
    if (!values || !values.length) return "";
    var parts = values.map(function (v) { return t(map[v] || v); });
    return t(labelKey) + ": " + parts.join(", ");
  }

  function saveSel() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var node = sel.anchorNode;
    var el = node && (node.nodeType === 1 ? node : node.parentNode);
    if (!el || !el.closest) return;
    var box = el.closest("[data-editor], [data-lead]");
    if (!box) return;
    lastEdit = box;
    savedRange = sel.getRangeAt(0);
  }

  function restoreSel() {
    var box = activeEditor();
    if (!box) return;
    box.focus();
    var sel = window.getSelection();
    if (!sel) return;
    if (savedRange && box.contains(savedRange.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
      return;
    }
    var range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange = range;
  }

  function paintFmtButtons() {
    document.querySelectorAll("[data-fmt]").forEach(function (btn) {
      var cmd = btn.getAttribute("data-fmt");
      btn.classList.toggle("is-on", Boolean(fmtState[cmd]));
    });
  }

  function resetFmtState() {
    fmtState.bold = false;
    fmtState.italic = false;
    fmtState.underline = false;
    fmtState.strikeThrough = false;
    paintFmtButtons();
  }

  function decoLineOf(el) {
    if (!el || el.nodeType !== 1) return "";
    return String(el.style.textDecorationLine || el.style.textDecoration || "");
  }

  function ownDeco(el) {
    if (!el || el.nodeType !== 1) return { u: false, s: false };
    var tag = el.tagName.toLowerCase();
    var line = decoLineOf(el);
    return {
      u: tag === "u" || line.indexOf("underline") >= 0,
      s: tag === "s" || tag === "strike" || tag === "del" || line.indexOf("line-through") >= 0
    };
  }

  function styleCaretSpan(span) {
    span.setAttribute("data-caret-fmt", "1");
    span.style.fontWeight = fmtState.bold ? "bold" : "normal";
    span.style.fontStyle = fmtState.italic ? "italic" : "normal";
    var deco = [];
    if (fmtState.underline) deco.push("underline");
    if (fmtState.strikeThrough) deco.push("line-through");
    var line = deco.length ? deco.join(" ") : "none";
    span.style.textDecoration = line;
    span.style.textDecorationLine = line;
    span.style.color = rgbColor();
  }

  function emptyCaretSpan(el) {
    if (!el || !el.getAttribute || el.getAttribute("data-caret-fmt") !== "1") return false;
    return String(el.textContent || "").replace(/\u200b/g, "") === "";
  }

  function splitDecorated(node, box) {
    var sel = window.getSelection();
    if (!node || node === box || !node.parentNode || !sel || !sel.rangeCount) return;
    var caret = sel.getRangeAt(0);
    if (!node.contains(caret.endContainer) && node !== caret.endContainer) return;
    var tail = document.createRange();
    tail.selectNodeContents(node);
    try {
      tail.setStart(caret.endContainer, caret.endOffset);
    } catch (err) {
      return;
    }
    var frag = tail.extractContents();
    var clone = node.cloneNode(false);
    clone.appendChild(frag);
    if (node.nextSibling) node.parentNode.insertBefore(clone, node.nextSibling);
    else node.parentNode.appendChild(clone);
    var r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    savedRange = r.cloneRange();
  }

  function liftCaretForFmt(box) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
    var node = sel.anchorNode;
    var el = node && (node.nodeType === 1 ? node : node.parentNode);
    var splitList = [];
    var walk = el;
    while (walk && walk !== box) {
      var d = ownDeco(walk);
      var keep = emptyCaretSpan(walk);
      if (!keep && ((d.s && !fmtState.strikeThrough) || (d.u && !fmtState.underline))) {
        splitList.push(walk);
      }
      walk = walk.parentNode;
    }
    var i;
    for (i = 0; i < splitList.length; i += 1) splitDecorated(splitList[i], box);
  }

  function applyCaretSpan() {
    var box = activeEditor();
    if (!box) return;
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
    liftCaretForFmt(box);
    sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
    var node = sel.anchorNode;
    var parent = node && (node.nodeType === 1 ? node : node.parentNode);
    if (emptyCaretSpan(parent)) {
      styleCaretSpan(parent);
      saveSel();
      return;
    }
    var range = sel.getRangeAt(0);
    var span = document.createElement("span");
    styleCaretSpan(span);
    span.appendChild(document.createTextNode("\u200b"));
    range.insertNode(span);
    range = document.createRange();
    range.setStart(span.firstChild, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange = range.cloneRange();
  }

  function applyFmt(cmd, val) {
    if (viewingLive) {
      askNotice(t("post_eye_lock"));
      return;
    }
    skipFmtSync = true;
    restoreSel();
    if (cmd === "foreColor") {
      try {
        document.execCommand("styleWithCSS", false, true);
        document.execCommand("foreColor", false, val || rgbColor());
      } catch (e) {}
      applyCaretSpan();
      saveSel();
      return;
    }
    fmtState[cmd] = !fmtState[cmd];
    var sel = window.getSelection();
    var hasRange = sel && sel.rangeCount && !sel.isCollapsed;
    if (hasRange) {
      try {
        document.execCommand("styleWithCSS", false, true);
        var now = false;
        try { now = document.queryCommandState(cmd); } catch (e2) {}
        if (now !== fmtState[cmd]) document.execCommand(cmd, false, null);
      } catch (e) {}
    }
    applyCaretSpan();
    saveSel();
    paintFmtButtons();
  }

  function applyColorLive() {
    if (!savedRange) return;
    var sel = window.getSelection();
    try {
      sel.removeAllRanges();
      sel.addRange(savedRange.cloneRange());
      if (sel.rangeCount && !sel.isCollapsed) {
        document.execCommand("styleWithCSS", false, true);
        document.execCommand("foreColor", false, rgbColor());
      } else {
        applyCaretSpan();
      }
      if (sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
    } catch (e) {}
  }

  function readComputedFmt(el) {
    var cs = window.getComputedStyle(el);
    var weight = String(cs.fontWeight || "");
    fmtState.bold = weight === "bold" || Number(weight) >= 700;
    fmtState.italic = cs.fontStyle === "italic" || cs.fontStyle === "oblique";
    var u = false;
    var s = false;
    var n = el;
    while (n && lastEdit && n !== lastEdit) {
      var d = ownDeco(n);
      if (d.u) u = true;
      if (d.s) s = true;
      n = n.parentNode;
    }
    fmtState.underline = u;
    fmtState.strikeThrough = s;
  }

  function syncFmtButtons() {
    if (skipFmtSync) {
      paintFmtButtons();
      return;
    }
    var sel = window.getSelection();
    var node = sel && sel.anchorNode;
    var el = node && (node.nodeType === 1 ? node : node.parentNode);
    var inEdit = el && el.closest && lastEdit && lastEdit.contains(el);
    if (sel && sel.rangeCount && inEdit) {
      if (!sel.isCollapsed) {
        ["bold", "italic", "underline", "strikeThrough"].forEach(function (cmd) {
          var on = false;
          try { on = document.queryCommandState(cmd); } catch (e) {}
          fmtState[cmd] = on;
        });
      } else {
        var caret = el.closest ? el.closest("[data-caret-fmt]") : null;
        if (caret && lastEdit.contains(caret)) {
          fmtState.bold = caret.style.fontWeight === "bold";
          fmtState.italic = caret.style.fontStyle === "italic";
          var deco = decoLineOf(caret);
          fmtState.underline = deco.indexOf("underline") >= 0;
          fmtState.strikeThrough = deco.indexOf("line-through") >= 0;
        } else {
          readComputedFmt(el);
        }
      }
    }
    paintFmtButtons();
  }

  function sanitizeHref(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    s = s.replace(/[\s<>"']/g, "");
    var lower = s.toLowerCase();
    if (lower.indexOf("javascript:") === 0 || lower.indexOf("data:") === 0 || lower.indexOf("vbscript:") === 0) return "";
    if (/^https?:\/\//i.test(s) || lower.indexOf("mailto:") === 0) return s;
    if (s.indexOf("://") >= 0) return "";
    if (s.charAt(0) === "#" || s.charAt(0) === "/") return s;
    return "https://" + s;
  }

  function sanitizeColor(value) {
    var c = String(value || "").trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c.toLowerCase();
    var rgb = c.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (rgb) {
      return "rgb(" + rgb[1] + ", " + rgb[2] + ", " + rgb[3] + ")";
    }
    return "";
  }

  function sanitizeHtml(html) {
    var root = document.createElement("div");
    root.innerHTML = html || "";
    var allow = { a: 1, b: 1, i: 1, u: 1, s: 1, strike: 1, del: 1, strong: 1, em: 1, span: 1, font: 1, br: 1, p: 1, div: 1, img: 1 };

    function clean(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 8) {
          node.removeChild(child);
          return;
        }
        if (child.nodeType !== 1) return;
        var tag = child.tagName.toLowerCase();
        if (!allow[tag]) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        if (tag === "font") {
          var fontColor = sanitizeColor(child.getAttribute("color") || "");
          var span = document.createElement("span");
          if (fontColor) span.setAttribute("style", "color: " + fontColor);
          while (child.firstChild) span.appendChild(child.firstChild);
          node.replaceChild(span, child);
          clean(span);
          return;
        }
        if (tag === "a") {
          var href = sanitizeHref(child.getAttribute("href") || "");
          Array.prototype.slice.call(child.attributes).forEach(function (attr) {
            child.removeAttribute(attr.name);
          });
          if (!href) {
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            node.removeChild(child);
            return;
          }
          child.setAttribute("href", href);
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
          clean(child);
          return;
        }
        if (tag === "img") {
          var src = child.getAttribute("src") || "";
          var idx = child.getAttribute("data-photo");
          Array.prototype.slice.call(child.attributes).forEach(function (attr) {
            child.removeAttribute(attr.name);
          });
          child.className = "post-embed-img";
          if (idx != null && idx !== "") child.setAttribute("data-photo", String(idx));
          if (/^data:image\/(jpeg|png|webp|gif);base64,/i.test(src)) child.setAttribute("src", src);
        } else if (tag === "span") {
          var color = sanitizeColor((child.getAttribute("style") || "").replace(/^[\s\S]*color:\s*/i, "").split(";")[0]);
          Array.prototype.slice.call(child.attributes).forEach(function (attr) {
            child.removeAttribute(attr.name);
          });
          if (color) child.setAttribute("style", "color: " + color);
        } else {
          Array.prototype.slice.call(child.attributes).forEach(function (attr) {
            child.removeAttribute(attr.name);
          });
        }
        clean(child);
      });
    }

    clean(root);
    return root.innerHTML;
  }

  function sanitizeLead(html) {
    var wrap = document.createElement("div");
    wrap.innerHTML = sanitizeHtml(html || "");
    wrap.querySelectorAll("img").forEach(function (img) {
      if (img.parentNode) img.parentNode.removeChild(img);
    });
    wrap.querySelectorAll("[style]").forEach(function (el) {
      el.removeAttribute("style");
    });
    return wrap.innerHTML;
  }

  function fillLeads(post) {
    ["en", "ua"].forEach(function (lang) {
      var el = $('[data-lead="' + lang + '"]');
      if (!el) return;
      var raw = post ? ((lang === "ua" ? post.lead_ua : post.lead_en) || "") : "";
      if (looksHtml(raw)) el.innerHTML = sanitizeLead(raw);
      else el.innerHTML = escapeText(raw);
    });
  }

  function readLead(lang) {
    var el = $('[data-lead="' + lang + '"]');
    if (!el) return "";
    if (formKind() === "project") return (el.textContent || "").replace(/\s+/g, " ").trim();
    var html = sanitizeLead(el.innerHTML);
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    if (!(tmp.textContent || "").trim()) return "";
    return html;
  }

  function looksHtml(text) {
    return /<[a-z][\s\S]*>/i.test(text || "");
  }

  function photoSrc(photo) {
    if (!photo || !photo.data || !photo.mime) return "";
    return "data:" + photo.mime + ";base64," + photo.data;
  }

  function htmlWithPhotos(html, photos) {
    var wrap = document.createElement("div");
    wrap.innerHTML = html || "";
    wrap.querySelectorAll("img[data-photo]").forEach(function (img) {
      var i = parseInt(img.getAttribute("data-photo"), 10);
      var src = photos && photos[i] ? photoSrc(photos[i]) : "";
      if (src) img.setAttribute("src", src);
    });
    return wrap.innerHTML;
  }

  function usedPhotoIndexes(html) {
    var wrap = document.createElement("div");
    wrap.innerHTML = html || "";
    var used = {};
    wrap.querySelectorAll("img[data-photo]").forEach(function (img) {
      used[img.getAttribute("data-photo")] = true;
    });
    return used;
  }

  function countEditorPhotos() {
    var keys = {};
    var n = 0;
    ["en", "ua"].forEach(function (lang) {
      var box = editor(lang);
      if (!box) return;
      box.querySelectorAll("img").forEach(function (img) {
        var src = img.getAttribute("src") || "";
        var m = src.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
        var key = m ? m[1] + "|" + m[2] : src;
        if (!key || keys[key]) return;
        keys[key] = true;
        n += 1;
      });
    });
    return n;
  }

  function packBodies() {
    var photos = [];
    var map = {};

    function eat(html) {
      var wrap = document.createElement("div");
      wrap.innerHTML = html || "";
      wrap.querySelectorAll("img").forEach(function (img) {
        var src = img.getAttribute("src") || "";
        var m = src.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
        if (!m) {
          img.parentNode.removeChild(img);
          return;
        }
        var key = m[1] + "|" + m[2];
        if (map[key] == null) {
          if (photos.length >= MAX_PHOTOS) {
            img.parentNode.removeChild(img);
            return;
          }
          if (m[2].length > 900000) {
            img.parentNode.removeChild(img);
            return;
          }
          map[key] = photos.length;
          photos.push({ mime: m[1], data: m[2] });
        }
        img.setAttribute("data-photo", String(map[key]));
        img.removeAttribute("src");
      });
      return sanitizeHtml(wrap.innerHTML);
    }

    var enBox = editor("en");
    var uaBox = editor("ua");
    return {
      photos: photos,
      bodyEn: eat(enBox ? enBox.innerHTML : ""),
      bodyUa: eat(uaBox ? uaBox.innerHTML : "")
    };
  }

  function fillEditors(post) {
    var enBox = editor("en");
    var uaBox = editor("ua");
    var photos = (post && post.photos) || [];
    var enHtml = post ? (post.body_en || "") : "";
    var uaHtml = post ? (post.body_ua || "") : "";
    if (enBox) enBox.innerHTML = looksHtml(enHtml) ? htmlWithPhotos(sanitizeHtml(enHtml), photos) : escapeText(enHtml);
    if (uaBox) uaBox.innerHTML = looksHtml(uaHtml) ? htmlWithPhotos(sanitizeHtml(uaHtml), photos) : escapeText(uaHtml);
    if (photos.length) {
      ["en", "ua"].forEach(function (lang) {
        var box = editor(lang);
        if (!box || box.querySelector("img")) return;
        photos.forEach(function (photo) {
          var src = photoSrc(photo);
          if (!src) return;
          var img = document.createElement("img");
          img.src = src;
          img.alt = "";
          box.appendChild(img);
        });
      });
    }
  }

  function escapeText(text) {
    var el = document.createElement("div");
    el.textContent = text || "";
    return el.innerHTML.replace(/\n/g, "<br>");
  }

  function formSnapshot() {
    var form = $("[data-post-form]");
    var kind = formKind();
    var packed = kind === "publication" ? packBodies() : { photos: [], bodyEn: "", bodyUa: "" };
    var meta = kind === "project" ? readMeta() : {};
    delete meta.draft;
    var snap = {
      kind: kind,
      title_en: form && form.title_en ? form.title_en.value : "",
      title_ua: form && form.title_ua ? form.title_ua.value : "",
      lead_en: readLead("en"),
      lead_ua: readLead("ua"),
      body_en: packed.bodyEn,
      body_ua: packed.bodyUa,
      photos: packed.photos,
      meta: meta
    };
    if (previewPhoto && previewPhoto.data) {
      snap.preview_mime = previewPhoto.mime;
      snap.preview_data = previewPhoto.data;
      snap.preview_name = previewPhoto.name || "";
    }
    return snap;
  }

  function fillFormFrom(data) {
    var form = $("[data-post-form]");
    if (!form || !data) return;
    form.kind.value = postKind(data);
    if (form.title_en) form.title_en.value = data.title_en || "";
    if (form.title_ua) form.title_ua.value = data.title_ua || "";
    fillLeads(data);
    fillEditors(data);
    writeMeta(postMeta(data));
    setPreview(data.preview_data && data.preview_mime
      ? { mime: data.preview_mime, data: data.preview_data, name: data.preview_name || postMeta(data).preview_name || "" }
      : null);
    syncFormKind();
  }

  function postToLiveSnap(post) {
    return {
      kind: postKind(post),
      title_en: post.title_en || "",
      title_ua: post.title_ua || "",
      lead_en: post.lead_en || "",
      lead_ua: post.lead_ua || "",
      body_en: post.body_en || "",
      body_ua: post.body_ua || "",
      photos: post.photos || [],
      meta: postMeta(post),
      preview_mime: post.preview_mime || "",
      preview_data: post.preview_data || "",
      preview_name: postMeta(post).preview_name || post.preview_name || ""
    };
  }

  function setLivePreview(on) {
    var form = $("[data-post-form]");
    var eye = $("[data-post-eye]");
    if (on && !viewingLive) workSnapshot = formSnapshot();
    if (!on && viewingLive && workSnapshot) fillFormFrom(workSnapshot);
    if (on && liveSnapshot) fillFormFrom(liveSnapshot);
    viewingLive = Boolean(on);
    if (form) form.classList.toggle("is-live-view", viewingLive);
    document.querySelectorAll("[data-post-eye]").forEach(function (btn) {
      btn.classList.toggle("is-on", viewingLive);
      btn.setAttribute("aria-pressed", viewingLive ? "true" : "false");
    });
    ["en", "ua"].forEach(function (lang) {
      var lead = $('[data-lead="' + lang + '"]');
      var box = editor(lang);
      if (lead) lead.setAttribute("contenteditable", viewingLive ? "false" : "true");
      if (box) box.setAttribute("contenteditable", viewingLive ? "false" : "true");
    });
    if (form) {
      ["title_en", "title_ua"].forEach(function (name) {
        if (form[name]) form[name].readOnly = viewingLive;
      });
    }
  }

  function syncEyeButton() {
    var show = Boolean(editingId && !editingWasDraft);
    document.querySelectorAll("[data-post-eye]").forEach(function (eye) {
      eye.hidden = !show;
      eye.classList.toggle("is-on", show && viewingLive);
      eye.setAttribute("aria-pressed", show && viewingLive ? "true" : "false");
    });
    if (!show && viewingLive) setLivePreview(false);
  }

  function syncKindLock() {
    var form = $("[data-post-form]");
    if (!form) return;
    form.classList.toggle("is-editing", Boolean(editingId));
    form.classList.toggle("is-draft-edit", Boolean(editingId && editingWasDraft));
  }

  function guardLiveView(e) {
    if (!viewingLive) return;
    var el = e.target;
    if (el && el.closest && el.closest("[data-post-eye], [data-post-lang], [data-post-close], .account-close, [data-post-save], [data-post-submit], [data-close-modal], [data-confirm-modal]")) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    askNotice(t("post_eye_lock"));
  }

  function resetEditor() {
    var form = $("[data-post-form]");
    viewingLive = false;
    liveSnapshot = null;
    workSnapshot = null;
    openSnapshot = null;
    editingWasDraft = false;
    if (form) {
      form.reset();
      form.classList.remove("is-live-view", "is-editing");
    }
    fillEditors(null);
    fillLeads(null);
    lastEdit = null;
    writeMeta({});
    setPreview(null);
    setPostError("");
    setPostLang(typeof getLang === "function" && getLang() === "ua" ? "ua" : "en");
    syncFormKind();
    resetFmtState();
    setPickerOpen(false);
    setLinkOpen(false);
    syncRgbPreview();
    setLivePreview(false);
    syncEyeButton();
    syncKindLock();
  }

  function syncSubmitLabel() {
    var btn = $("[data-post-submit]");
    if (!btn) return;
    var key = editingId ? "post_edit" : "post_publish";
    btn.setAttribute("data-i18n", key);
    btn.textContent = t(key);
  }

  function openPostModal() {
    var modal = $("[data-post-modal]");
    if (!modal) return;
    window.clearTimeout(closeTimer);
    modal.hidden = false;
    setPostError("");
    syncSubmitLabel();
    if (typeof window.applyI18n === "function") applyI18n();
    syncSubmitLabel();
    syncKindLock();
    syncEyeButton();
    window.requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });
  }

  function forceClosePostModal() {
    hideCloseAsk();
    var modal = $("[data-post-modal]");
    if (modal) {
      modal.classList.remove("is-open");
      closeTimer = window.setTimeout(function () {
        modal.hidden = true;
        editingId = null;
        resetEditor();
      }, 280);
    } else {
      editingId = null;
      resetEditor();
    }
  }

  function askConfirm(message, onYes) {
    var box = $("[data-confirm-modal]");
    var text = $("[data-confirm-text]");
    if (!box || !text) {
      if (window.confirm(message)) onYes();
      return;
    }
    text.textContent = message;
    confirmFn = onYes;
    window.clearTimeout(confirmTimer);
    box.hidden = false;
    if (typeof window.applyI18n === "function") applyI18n();
    text.textContent = message;
    window.requestAnimationFrame(function () {
      box.classList.add("is-open");
    });
  }

  function askNotice(message) {
    if (noticeLock) return;
    noticeLock = true;
    var no = $("[data-confirm-no]");
    if (no) no.hidden = true;
    askConfirm(message, function () {
      noticeLock = false;
    });
  }

  function hideConfirm() {
    var box = $("[data-confirm-modal]");
    var no = $("[data-confirm-no]");
    noticeLock = false;
    if (box) {
      box.classList.remove("is-open");
      confirmTimer = window.setTimeout(function () {
        box.hidden = true;
        if (no) no.hidden = false;
      }, 280);
    } else if (no) {
      no.hidden = false;
    }
    confirmFn = null;
  }

  function htmlPlain(html) {
    var d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.textContent || "").replace(/\u200b/g, "").trim();
  }

  function snapshotKey(s) {
    if (!s) return "";
    var m = s.meta || {};
    return JSON.stringify({
      kind: s.kind || "",
      title_en: (s.title_en || "").trim(),
      title_ua: (s.title_ua || "").trim(),
      lead_en: htmlPlain(s.lead_en),
      lead_ua: htmlPlain(s.lead_ua),
      body_en: htmlPlain(s.body_en),
      body_ua: htmlPlain(s.body_ua),
      types: m.types || [],
      state: m.state || "",
      status: m.status || "",
      versions: m.versions || [],
      platforms: m.platforms || [],
      preview: s.preview_data ? String(s.preview_data).length : 0,
      photos: (s.photos || []).map(function (p) { return (p && p.data) ? String(p.data).length : 0; })
    });
  }

  function isCreateEmpty() {
    var s = formSnapshot();
    if ((s.title_en || "").trim() || (s.title_ua || "").trim()) return false;
    if (htmlPlain(s.lead_en) || htmlPlain(s.lead_ua) || htmlPlain(s.body_en) || htmlPlain(s.body_ua)) return false;
    if (s.preview_data || (s.photos && s.photos.length)) return false;
    var m = s.meta || {};
    if ((m.types && m.types.length) || m.state || m.status || (m.versions && m.versions.length) || (m.platforms && m.platforms.length)) return false;
    return true;
  }

  function isUnchangedEdit() {
    if (!openSnapshot) return false;
    var now = viewingLive && workSnapshot ? workSnapshot : formSnapshot();
    return snapshotKey(now) === snapshotKey(openSnapshot);
  }

  function requestClose() {
    if (!editingId && isCreateEmpty()) {
      forceClosePostModal();
      return;
    }
    if (editingId && isUnchangedEdit()) {
      forceClosePostModal();
      return;
    }
    var box = $("[data-close-modal]");
    if (!box) {
      forceClosePostModal();
      return;
    }
    window.clearTimeout(confirmTimer);
    box.hidden = false;
    if (typeof window.applyI18n === "function") applyI18n();
    window.requestAnimationFrame(function () {
      box.classList.add("is-open");
    });
  }

  function hideCloseAsk() {
    var box = $("[data-close-modal]");
    if (!box) return;
    box.classList.remove("is-open");
    confirmTimer = window.setTimeout(function () {
      box.hidden = true;
    }, 280);
  }

  function heartSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.7-4.35-9.33-8.5C.5 9.5 1.5 5.5 5 4.2 7.1 3.4 9.4 4 12 6.2 14.6 4 16.9 3.4 19 4.2c3.5 1.3 4.5 5.3 2.33 8.3C18.7 16.65 12 21 12 21z"/></svg>';
  }

  function dislikeSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3L7 11v10h11.2a2 2 0 0 0 2-1.7l1.6-8A2 2 0 0 0 18.8 9H14z"/></svg>';
  }

  function commentCountSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v10H8l-4 4V5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }

  function applyVoteResult(root, data) {
    if (!root || !data) return;
    var likeBtn = root.querySelector("[data-post-like]");
    var dislikeBtn = root.querySelector("[data-post-dislike]");
    var likeCount = root.querySelector("[data-like-count]");
    var dislikeCount = root.querySelector("[data-dislike-count]");
    if (likeBtn) likeBtn.classList.toggle("is-liked", Boolean(data.liked));
    if (dislikeBtn) dislikeBtn.classList.toggle("is-disliked", Boolean(data.disliked));
    if (likeCount && data.likes != null) likeCount.textContent = data.likes;
    if (dislikeCount && data.dislikes != null) dislikeCount.textContent = data.dislikes;
  }

  function fillReact(react, post, article, withComments) {
    react.innerHTML =
      '<span class="post-views">' + eyeSvg() + '<span data-view-count>' + (post.views || 0) + "</span></span>" +
      '<button type="button" class="like-btn' + (post.liked ? " is-liked" : "") + '" data-post-like>' +
      heartSvg() + '<span data-like-count>' + (post.likes || 0) + "</span></button>" +
      '<button type="button" class="like-btn' + (post.disliked ? " is-disliked" : "") + '" data-post-dislike>' +
      dislikeSvg() + '<span data-dislike-count>' + (post.dislikes || 0) + "</span></button>" +
      (withComments
        ? '<span class="post-views">' + commentCountSvg() + '<span data-comment-count>' + (post.comment_count || 0) + "</span></span>"
        : "");
    var likeBtn = react.querySelector("[data-post-like]");
    var dislikeBtn = react.querySelector("[data-post-dislike]");
    if (likeBtn) likeBtn.addEventListener("click", function () { toggleVote(post.id, article, "like"); });
    if (dislikeBtn) dislikeBtn.addEventListener("click", function () { toggleVote(post.id, article, "dislike"); });
  }

  function toggleVote(postId, article, kind) {
    if (!token()) {
      if (window.DandelionAuth && window.DandelionAuth.openLogin) window.DandelionAuth.openLogin();
      return;
    }
    var name = kind === "dislike" ? "toggle_post_dislike" : "toggle_post_like";
    rpc(name, { p_post: postId, p_token: token() })
      .then(function (data) {
        if (!data || !data.ok) {
          if (data && data.error === "auth" && window.DandelionAuth && window.DandelionAuth.openLogin) {
            window.DandelionAuth.openLogin();
          }
          return;
        }
        applyVoteResult(article, data);
      })
      .catch(function () {});
  }

  function eyeSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6 5 2.3 10.2 2 12c.3 1.8 4 7 10 7s9.7-5.2 10-7c-.3-1.8-4-7-10-7zm0 10.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4z"/></svg>';
  }

  function closeMenus() {
    document.querySelectorAll(".post-menu.is-open").forEach(function (el) {
      el.classList.remove("is-open");
    });
  }

  function renderPosts(list) {
    var box = $("[data-posts]");
    if (!box) return;
    lastPosts = list || [];
    box.innerHTML = "";
    var shown = filteredPosts(lastPosts);
    syncFeedMore();
    if (!shown.length) return;
    var lang = typeof getLang === "function" ? getLang() : "en";
    var admin = isAdmin();
    shown.forEach(function (post) {
      var article = document.createElement("article");
      article.className = "post";
      article.setAttribute("data-post-id", post.id);
      if (admin && isDraftPost(post)) {
        article.classList.add("post-is-draft");
        var mark = document.createElement("p");
        mark.className = "post-draft";
        mark.textContent = t("post_draft");
        article.appendChild(mark);
      } else if (admin && isPendingPost(post)) {
        article.classList.add("post-is-pending");
        var pend = document.createElement("p");
        pend.className = "post-pending";
        pend.textContent = t("post_pending");
        article.appendChild(pend);
      }

      if (admin) {
        var tools = document.createElement("div");
        tools.className = "post-tools";
        var dots = document.createElement("button");
        dots.type = "button";
        dots.className = "post-dots";
        dots.textContent = "...";
        dots.setAttribute("aria-label", t("post_more"));
        var menu = document.createElement("div");
        menu.className = "post-menu";
        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "post-menu-item";
        editBtn.textContent = t("post_edit");
        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "post-menu-item";
        delBtn.textContent = t("post_delete");
        dots.addEventListener("click", function (e) {
          e.stopPropagation();
          var open = !menu.classList.contains("is-open");
          closeMenus();
          menu.classList.toggle("is-open", open);
        });
        editBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          closeMenus();
          startEdit(post);
        });
        delBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          closeMenus();
          askDelete(post.id);
        });
        menu.appendChild(editBtn);
        menu.appendChild(delBtn);
        tools.appendChild(dots);
        tools.appendChild(menu);
        article.appendChild(tools);
      }

      var isProject = postKind(post) === "project";
      var title = isProject
        ? (post.title_en || post.title_ua)
        : (lang === "ua" ? (post.title_ua || post.title_en) : (post.title_en || post.title_ua));
      var lead = lang === "ua" ? (post.lead_ua || post.lead_en) : (post.lead_en || post.lead_ua);
      var body = isProject ? "" : (lang === "ua" ? (post.body_ua || post.body_en) : (post.body_en || post.body_ua));
      var host = article;

      if (isProject) {
        article.classList.add("post-is-project");
        if (title) {
          var h = document.createElement("h2");
          h.className = "post-title";
          var link = document.createElement("a");
          link.href = "project.html?id=" + encodeURIComponent(post.id);
          link.textContent = title;
          h.appendChild(link);
          article.appendChild(h);
        }
        if (post.preview_data && post.preview_mime) {
          var previewImg = document.createElement("img");
          previewImg.className = "post-preview";
          previewImg.src = "data:" + post.preview_mime + ";base64," + post.preview_data;
          previewImg.alt = "";
          article.appendChild(previewImg);
        } else {
          var emptyPrev = document.createElement("div");
          emptyPrev.className = "post-preview-empty";
          article.appendChild(emptyPrev);
        }
        host = document.createElement("div");
        host.className = "post-project-main";
        article.appendChild(host);
      } else {
        var when = formatWhen(post.created_at);
        if (when) {
          var time = document.createElement("p");
          time.className = "post-when";
          time.textContent = when;
          host.appendChild(time);
        }
        if (title) {
          var h2 = document.createElement("h2");
          h2.className = "post-title";
          h2.textContent = title;
          host.appendChild(h2);
        }
      }

      if (lead) {
        var leadEl = document.createElement("p");
        if (looksHtml(lead)) {
          leadEl.className = "post-lead post-lead-html";
          leadEl.innerHTML = sanitizeLead(lead);
        } else {
          leadEl.className = "post-lead";
          leadEl.textContent = lead;
        }
        host.appendChild(leadEl);
      }
      if (isProject && post.meta) {
        var meta = postMeta(post);
        var lines = [];
        var typeKeys = { mod: "proj_type_mod", datapack: "proj_type_datapack", resourcepack: "proj_type_resourcepack" };
        var stateKeys = { release: "proj_state_release", open_beta: "proj_state_open_beta", closed_beta: "proj_state_closed_beta" };
        var statusKeys = { ready: "proj_status_ready", wip: "proj_status_wip", paused: "proj_status_paused", planned: "proj_status_planned" };
        var plat = { vanilla: "Vanilla", fabric: "Fabric", neoforge: "NeoForge", forge: "Forge" };
        if (meta.types && meta.types.length) {
          lines.push(t("proj_types") + ": " + meta.types.map(function (v) { return t(typeKeys[v] || v); }).join(", "));
        }
        if (meta.state && stateKeys[meta.state]) lines.push(t("proj_state") + ": " + t(stateKeys[meta.state]));
        if (meta.status && statusKeys[meta.status]) lines.push(t("proj_status") + ": " + t(statusKeys[meta.status]));
        if (meta.versions && meta.versions.length) lines.push(t("proj_versions") + ": " + meta.versions.join(", "));
        if (meta.platforms && meta.platforms.length) {
          lines.push(t("proj_platforms") + ": " + meta.platforms.map(function (v) { return plat[v] || v; }).join(", "));
        }
        if (lines.length) {
          var metaEl = document.createElement("div");
          metaEl.className = "post-meta";
          lines.forEach(function (line) {
            var mp = document.createElement("p");
            mp.textContent = line;
            metaEl.appendChild(mp);
          });
          host.appendChild(metaEl);
        }
      }
      if (body) {
        var p = document.createElement("div");
        if (looksHtml(body)) {
          p.className = "post-body post-body-html";
          p.innerHTML = htmlWithPhotos(sanitizeHtml(body), post.photos || []);
        } else {
          p.className = "post-body";
          p.textContent = body;
        }
        host.appendChild(p);
      }

      var used = usedPhotoIndexes(looksHtml(body) ? body : "");
      var leftovers = isProject ? [] : (post.photos || []).filter(function (photo, i) {
        return photo && photo.data && !used[String(i)];
      });
      if (leftovers.length) {
        var gallery = document.createElement("div");
        gallery.className = "post-photos";
        leftovers.forEach(function (photo) {
          var img = document.createElement("img");
          img.src = photoSrc(photo);
          img.alt = "";
          gallery.appendChild(img);
        });
        host.appendChild(gallery);
      }

      if (isProject) {
        var foot = document.createElement("div");
        foot.className = "post-card-foot";
        var comBtn = document.createElement("button");
        comBtn.type = "button";
        comBtn.className = "post-card-comment";
        var top = post.top_comment;
        if (top && top.body) {
          var nickEl = document.createElement("b");
          nickEl.className = "post-card-comment-nick";
          nickEl.textContent = top.nick || "";
          comBtn.appendChild(nickEl);
          var tmp = document.createElement("div");
          tmp.innerHTML = top.body;
          var plain = (tmp.textContent || "").replace(/\s+/g, " ").trim();
          if (plain.length > 90) plain = plain.slice(0, 90) + "…";
          var txt = document.createElement("span");
          txt.textContent = plain;
          comBtn.appendChild(txt);
        } else {
          comBtn.textContent = t("post_write_comment");
        }
        comBtn.addEventListener("click", function () {
          openComments(post);
        });
        var stats = document.createElement("div");
        stats.className = "post-card-stats post-react";
        fillReact(stats, post, article, true);
        foot.appendChild(comBtn);
        foot.appendChild(stats);
        article.appendChild(foot);
      } else {
        var react = document.createElement("div");
        react.className = "post-react";
        fillReact(react, post, article, false);
        host.appendChild(react);
      }

      box.appendChild(article);
    });
  }

  function loadPosts() {
    var tok = token();
    var req = tok ? rpc("list_posts", { p_token: tok }) : rpc("list_posts", {});
    req
      .catch(function () {
        return rpc("list_posts", {});
      })
      .then(function (data) {
        if (data && data.ok) {
          renderPosts(data.posts || []);
          recordViews(filteredPosts(lastPosts));
        }
      })
      .catch(function () {});
  }

  function recordViews(list) {
    var visitor = visitorId();
    list.forEach(function (post) {
      if (isDraftPost(post)) return;
      rpc("record_post_view", { p_post: post.id, p_visitor: visitor })
        .then(function (data) {
          if (!data || !data.ok) return;
          var el = document.querySelector('[data-post-id="' + post.id + '"] [data-view-count]');
          if (el) el.textContent = data.views;
        })
        .catch(function () {});
    });
  }

  var commentPostId = null;
  var COMMENT_MAX = 300;

  function commentLen() {
    var box = $("[data-comment-edit]");
    if (!box) return 0;
    return (box.textContent || "").replace(/\u200b/g, "").trim().length;
  }

  function syncCommentCount() {
    var el = $("[data-comment-count-label]");
    if (el) el.textContent = commentLen() + "/" + COMMENT_MAX;
  }

  function sanitizeCommentHtml(html) {
    var root = document.createElement("div");
    root.innerHTML = html || "";
    var allow = { b: 1, i: 1, u: 1, s: 1, strike: 1, br: 1, div: 1, p: 1, span: 1 };
    Array.prototype.slice.call(root.querySelectorAll("*")).forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      if (!allow[tag]) {
        while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
        el.parentNode.removeChild(el);
        return;
      }
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        el.removeAttribute(attr.name);
      });
    });
    return root.innerHTML;
  }

  function renderComments(list) {
    var box = $("[data-comment-list]");
    if (!box) return;
    box.innerHTML = "";
    (list || []).forEach(function (c) {
      var item = document.createElement("div");
      item.className = "comment-item";
      item.setAttribute("data-comment-id", c.id);
      var head = document.createElement("div");
      head.className = "comment-head";
      var nick = document.createElement("b");
      nick.textContent = c.nick || "";
      var when = document.createElement("span");
      when.textContent = formatWhen(c.created_at);
      head.appendChild(nick);
      head.appendChild(when);
      var body = document.createElement("div");
      body.className = "comment-body";
      body.innerHTML = sanitizeCommentHtml(c.body || "");
      var votes = document.createElement("div");
      votes.className = "comment-votes";
      votes.innerHTML =
        '<button type="button" class="comment-vote' + (c.liked ? " is-liked" : "") + '" data-c-like>' +
        heartSvg() + '<span data-c-likes>' + (c.likes || 0) + "</span></button>" +
        '<button type="button" class="comment-vote' + (c.disliked ? " is-disliked" : "") + '" data-c-dislike>' +
        dislikeSvg() + '<span data-c-dislikes>' + (c.dislikes || 0) + "</span></button>";
      function vote(n) {
        if (!token()) {
          if (window.DandelionAuth && window.DandelionAuth.openLogin) window.DandelionAuth.openLogin();
          return;
        }
        rpc("toggle_comment_vote", { p_token: token(), p_comment: c.id, p_vote: n })
          .then(function (data) {
            if (!data || !data.ok) {
              if (data && data.error === "auth" && window.DandelionAuth && window.DandelionAuth.openLogin) {
                window.DandelionAuth.openLogin();
              }
              return;
            }
            var up = votes.querySelector("[data-c-like]");
            var down = votes.querySelector("[data-c-dislike]");
            if (up) up.classList.toggle("is-liked", Boolean(data.liked));
            if (down) down.classList.toggle("is-disliked", Boolean(data.disliked));
            var lc = votes.querySelector("[data-c-likes]");
            var dc = votes.querySelector("[data-c-dislikes]");
            if (lc) lc.textContent = data.likes;
            if (dc) dc.textContent = data.dislikes;
          })
          .catch(function () {});
      }
      votes.querySelector("[data-c-like]").addEventListener("click", function () { vote(1); });
      votes.querySelector("[data-c-dislike]").addEventListener("click", function () { vote(-1); });
      item.appendChild(head);
      item.appendChild(body);
      item.appendChild(votes);
      box.appendChild(item);
    });
  }

  function loadComments() {
    if (!commentPostId) return;
    var tok = token();
    rpc("list_comments", tok ? { p_post: commentPostId, p_token: tok } : { p_post: commentPostId })
      .then(function (data) {
        if (data && data.ok) renderComments(data.comments || []);
      })
      .catch(function () {
        renderComments([]);
      });
  }

  function openComments(post) {
    commentPostId = post.id;
    var modal = $("[data-comment-modal]");
    var edit = $("[data-comment-edit]");
    if (edit) edit.innerHTML = "";
    syncCommentCount();
    loadComments();
    if (!modal) return;
    modal.hidden = false;
    if (typeof window.applyI18n === "function") applyI18n();
    window.requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });
  }

  function hideComments() {
    var modal = $("[data-comment-modal]");
    if (!modal) return;
    modal.classList.remove("is-open");
    window.setTimeout(function () {
      modal.hidden = true;
      commentPostId = null;
    }, 280);
  }

  function sendComment() {
    if (!token()) {
      var errAuth = $("[data-comment-error]");
      if (errAuth) errAuth.textContent = t("err_comment_auth");
      if (window.DandelionAuth && window.DandelionAuth.openLogin) window.DandelionAuth.openLogin();
      return;
    }
    var edit = $("[data-comment-edit]");
    if (!edit || !commentPostId) return;
    var err = $("[data-comment-error]");
    if (err) err.textContent = "";
    if (commentLen() > COMMENT_MAX) {
      if (err) err.textContent = t("err_comment_long");
      return;
    }
    var html = sanitizeCommentHtml(edit.innerHTML);
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    if (!(tmp.textContent || "").replace(/\u200b/g, "").trim()) return;
    rpc("add_comment", { p_token: token(), p_post: commentPostId, p_body: html })
      .then(function (data) {
        if (!data || !data.ok) {
          if (data && data.error === "auth" && window.DandelionAuth && window.DandelionAuth.openLogin) {
            window.DandelionAuth.openLogin();
          }
          return;
        }
        edit.innerHTML = "";
        syncCommentCount();
        loadComments();
        loadPosts();
      })
      .catch(function () {});
  }

  function startEdit(post) {
    function go(full) {
      var form = $("[data-post-form]");
      if (!form || !full) return;
      editingId = full.id;
      editingWasDraft = isDraftPost(full);
      liveSnapshot = postToLiveSnap(full);
      workSnapshot = parsePending(full);
      viewingLive = false;
      fillFormFrom(workSnapshot || liveSnapshot);
      setPostLang(typeof getLang === "function" && getLang() === "ua" ? "ua" : "en");
      syncKindLock();
      openPostModal();
      setLivePreview(false);
      syncEyeButton();
      openSnapshot = formSnapshot();
    }
    var tok = token();
    if (!tok) {
      go(post);
      return;
    }
    rpc("get_post", { p_token: tok, p_id: post.id })
      .then(function (data) {
        go(data && data.ok && data.post ? data.post : post);
      })
      .catch(function () {
        go(post);
      });
  }

  function askDelete(postId) {
    askConfirm(t("post_delete_confirm"), function () {
      rpc("delete_post", { p_token: token(), p_id: postId })
        .then(function (data) {
          if (data && data.ok) loadPosts();
        })
        .catch(function () {});
    });
  }

  function rgbColor() {
    var r = $('[data-rgb="r"]');
    var g = $('[data-rgb="g"]');
    var b = $('[data-rgb="b"]');
    return "rgb(" + (r ? r.value : 40) + ", " + (g ? g.value : 64) + ", " + (b ? b.value : 47) + ")";
  }

  function hsvToRgb(h, s, v) {
    var c = v * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = v - c;
    var r = 0;
    var g = 0;
    var b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var d = max - min;
    var h = pickH;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: max === 0 ? 0 : d / max, v: max };
  }

  function hsvFromSliders() {
    var c = rgbParts();
    var hsv = rgbToHsv(c.r, c.g, c.b);
    pickH = hsv.h;
    pickS = hsv.s;
    pickV = hsv.v;
  }

  function applyHsvToRgb() {
    var rgb = hsvToRgb(pickH, pickS, pickV);
    var r = $('[data-rgb="r"]');
    var g = $('[data-rgb="g"]');
    var b = $('[data-rgb="b"]');
    if (r) r.value = rgb.r;
    if (g) g.value = rgb.g;
    if (b) b.value = rgb.b;
    syncRgbPreview();
    applyColorLive();
  }

  function paintPicker() {
    var sv = $("[data-rgb-sv-canvas]");
    var hue = $("[data-rgb-hue-canvas]");
    if (sv) {
      var ctx = sv.getContext("2d");
      var w = sv.width;
      var h = sv.height;
      var top = hsvToRgb(pickH, 1, 1);
      ctx.fillStyle = "rgb(" + top.r + "," + top.g + "," + top.b + ")";
      ctx.fillRect(0, 0, w, h);
      var white = ctx.createLinearGradient(0, 0, w, 0);
      white.addColorStop(0, "#ffffff");
      white.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = white;
      ctx.fillRect(0, 0, w, h);
      var black = ctx.createLinearGradient(0, 0, 0, h);
      black.addColorStop(0, "rgba(0,0,0,0)");
      black.addColorStop(1, "#000000");
      ctx.fillStyle = black;
      ctx.fillRect(0, 0, w, h);
    }
    if (hue) {
      var hctx = hue.getContext("2d");
      var hh = hue.height;
      var hw = hue.width;
      var i;
      for (i = 0; i < hh; i += 1) {
        var rgb = hsvToRgb((i / hh) * 360, 1, 1);
        hctx.fillStyle = "rgb(" + rgb.r + "," + rgb.g + "," + rgb.b + ")";
        hctx.fillRect(0, i, hw, 2);
      }
    }
    var dot = $("[data-rgb-sv-dot]");
    if (dot) {
      dot.style.left = (pickS * 100) + "%";
      dot.style.top = ((1 - pickV) * 100) + "%";
    }
    var mark = $("[data-rgb-hue-mark]");
    if (mark) mark.style.top = ((pickH / 360) * 100) + "%";
  }

  function setPickerOpen(open) {
    var wrap = $("[data-rgb-pick-wrap]");
    var panel = $("[data-rgb-panel]");
    var btn = $("[data-rgb-pick]");
    if (!wrap || !panel || !btn) return;
    wrap.classList.toggle("is-open", open);
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
    if (open) {
      hsvFromSliders();
      paintPicker();
      setLinkOpen(false);
    }
  }

  function snapshotLinkRange() {
    var box = activeEditor();
    var range = null;
    var sel = window.getSelection();
    if (sel && sel.rangeCount) {
      var node = sel.anchorNode;
      var el = node && (node.nodeType === 1 ? node : node.parentNode);
      if (el && el.closest && el.closest("[data-editor], [data-lead]")) {
        range = sel.getRangeAt(0).cloneRange();
      }
    }
    if (!range && savedRange) {
      try { range = savedRange.cloneRange(); } catch (e) {}
    }
    linkRange = range;
  }

  function restoreLinkRange() {
    var box = activeEditor();
    if (!box || !linkRange) return false;
    try {
      if (!box.contains(linkRange.commonAncestorContainer) && box !== linkRange.commonAncestorContainer) return false;
      box.focus();
      var sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(linkRange.cloneRange());
      return true;
    } catch (e) {
      return false;
    }
  }

  function linkFromRange() {
    if (!linkRange) return null;
    var node = linkRange.commonAncestorContainer;
    var el = node && (node.nodeType === 1 ? node : node.parentNode);
    if (!el || !el.closest) return null;
    var a = el.closest("a");
    var box = activeEditor();
    if (!a || !box || !box.contains(a)) return null;
    return a;
  }

  function linkAtCaret() {
    return linkFromRange() || (function () {
      var sel = window.getSelection();
      var node = sel && sel.anchorNode;
      var el = node && (node.nodeType === 1 ? node : node.parentNode);
      if (!el || !el.closest) return null;
      var a = el.closest("a");
      var box = activeEditor();
      if (!a || !box || !box.contains(a)) return null;
      return a;
    })();
  }

  function applyLink(url) {
    var href = sanitizeHref(url);
    if (!href) return;
    skipFmtSync = true;
    restoreLinkRange() || restoreSel();
    var sel = window.getSelection();
    var existing = linkAtCaret();
    if (existing && sel && (sel.isCollapsed || existing.contains(sel.anchorNode))) {
      existing.setAttribute("href", href);
      existing.setAttribute("target", "_blank");
      existing.setAttribute("rel", "noopener noreferrer");
      saveSel();
      return;
    }
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    var range = sel.getRangeAt(0);
    var a = document.createElement("a");
    a.setAttribute("href", href);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
    var contents = range.extractContents();
    if (!(contents.textContent || "").replace(/\u200b/g, "").trim() && !contents.querySelector("img")) {
      range.insertNode(contents);
      return;
    }
    a.appendChild(contents);
    range.insertNode(a);
    saveSel();
  }

  function setLinkOpen(open, btn) {
    var pop = $("[data-link-pop]");
    var input = $("[data-link-input]");
    if (!pop) return;
    pop.hidden = !open;
    pop.classList.toggle("is-open", open);
    document.querySelectorAll("[data-link-btn]").forEach(function (b) {
      b.classList.toggle("is-on", Boolean(open && (!btn || b === btn)));
    });
    if (!open) {
      linkRange = null;
      return;
    }
    setPickerOpen(false);
    restoreSel();
    snapshotLinkRange();
    var existing = linkAtCaret();
    if (input) input.value = existing ? (existing.getAttribute("href") || "") : "";
    if (btn) {
      var r = btn.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 300)) + "px";
      pop.style.top = (r.bottom + 6) + "px";
      var ph = pop.offsetHeight || 52;
      if (r.bottom + 6 + ph > window.innerHeight) {
        pop.style.top = Math.max(8, r.top - 6 - ph) + "px";
      }
    }
    if (input) {
      window.setTimeout(function () {
        input.focus();
        input.select();
      }, 0);
    }
  }

  function setWriteColor(hex) {
    var parsed = parseHex(hex);
    if (!parsed) return;
    var r = $('[data-rgb="r"]');
    var g = $('[data-rgb="g"]');
    var b = $('[data-rgb="b"]');
    if (r) r.value = parsed.r;
    if (g) g.value = parsed.g;
    if (b) b.value = parsed.b;
    hsvFromSliders();
    syncRgbPreview();
  }

  function rgbParts() {
    var r = $('[data-rgb="r"]');
    var g = $('[data-rgb="g"]');
    var b = $('[data-rgb="b"]');
    return {
      r: r ? Number(r.value) : 40,
      g: g ? Number(g.value) : 64,
      b: b ? Number(b.value) : 47
    };
  }

  function syncRgbPreview() {
    var c = rgbParts();
    var preview = $("[data-rgb-apply]");
    var hex = $("[data-rgb-hex]");
    var r = $('[data-rgb="r"]');
    var g = $('[data-rgb="g"]');
    var b = $('[data-rgb="b"]');
    if (preview) preview.style.background = rgbColor();
    var hexStr = "#" + toHex(c.r) + toHex(c.g) + toHex(c.b);
    if (hex && document.activeElement !== hex) hex.value = hexStr;
    var pick = $("[data-rgb-pick]");
    if (pick) pick.style.background = hexStr;
    var wrap = $("[data-rgb-pick-wrap]");
    if (wrap && wrap.classList.contains("is-open")) paintPicker();
    if (r) r.style.setProperty("--rgb-track", "linear-gradient(to top, rgb(0," + c.g + "," + c.b + "), rgb(255," + c.g + "," + c.b + "))");
    if (g) g.style.setProperty("--rgb-track", "linear-gradient(to top, rgb(" + c.r + ",0," + c.b + "), rgb(" + c.r + ",255," + c.b + "))");
    if (b) b.style.setProperty("--rgb-track", "linear-gradient(to top, rgb(" + c.r + "," + c.g + ",0), rgb(" + c.r + "," + c.g + ",255))");
  }

  function insertPhoto(file) {
    if (viewingLive) {
      askNotice(t("post_eye_lock"));
      return;
    }
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setPostError("photo_big");
      return;
    }
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].indexOf(file.type) === -1) {
      setPostError("photo_type");
      return;
    }
    if (countEditorPhotos() >= MAX_PHOTOS) {
      setPostError("photo_many");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var src = String(reader.result || "");
      if (!src) return;
      restoreSel();
      try {
        document.execCommand("insertHTML", false, '<img src="' + src + '" alt="">');
      } catch (e) {
        var box = activeEditor();
        if (!box) return;
        var img = document.createElement("img");
        img.src = src;
        img.alt = "";
        box.appendChild(img);
      }
      saveSel();
      setPostError("");
    };
    reader.readAsDataURL(file);
  }

  function savePost(asDraft, closeAfter) {
    var form = $("[data-post-form]");
    if (!form) return;
    if (viewingLive) setLivePreview(false);
    var auth = token();
    if (!auth) {
      setPostError("auth");
      return;
    }
    var kind = form.kind && form.kind.value === "publication" ? "publication" : "project";
    var titleEn = (form.title_en.value || "").trim();
    var titleUa = kind === "project" ? titleEn : (form.title_ua ? (form.title_ua.value || "").trim() : "");
    var leadEn = readLead("en");
    var leadUa = readLead("ua");
    if (!titleEn && !titleUa) {
      setPostError("empty_post");
      return;
    }
    var packed = kind === "publication" ? packBodies() : { photos: [], bodyEn: "", bodyUa: "" };
    var meta = kind === "project" ? readMeta() : {};
    if (previewPhoto && previewPhoto.name) meta.preview_name = previewPhoto.name;
    var publishedEdit = Boolean(editingId && !editingWasDraft);
    meta.draft = Boolean(asDraft && !publishedEdit);
    setPostError("");
    var payload = {
      p_token: auth,
      p_title_en: titleEn,
      p_title_ua: titleUa,
      p_body_en: packed.bodyEn,
      p_body_ua: packed.bodyUa,
      p_photos: packed.photos,
      p_kind: kind,
      p_lead_en: leadEn,
      p_lead_ua: leadUa,
      p_meta: meta,
      p_draft: Boolean(asDraft && !publishedEdit)
    };
    if (previewPhoto) payload.p_preview = previewPhoto;
    if (editingId) payload.p_id = editingId;
    if (asDraft && publishedEdit) payload.p_pending = formSnapshot();
    else if (editingId) payload.p_pending = null;
    var name = editingId ? "update_post" : "create_post";
    rpc(name, payload)
      .catch(function () {
        delete payload.p_pending;
        return rpc(name, payload);
      })
      .catch(function () {
        delete payload.p_draft;
        return rpc(name, payload);
      })
      .catch(function () {
        delete payload.p_preview;
        delete payload.p_meta;
        return rpc(name, payload);
      })
      .catch(function () {
        delete payload.p_lead_en;
        delete payload.p_lead_ua;
        return rpc(name, payload);
      })
      .catch(function () {
        delete payload.p_kind;
        return rpc(name, payload);
      })
      .then(function (data) {
        if (!data || !data.ok) {
          setPostError((data && data.error) || "fail");
          return;
        }
        if (data.id) editingId = data.id;
        syncSubmitLabel();
        loadPosts();
        if (closeAfter) forceClosePostModal();
      })
      .catch(function (err) {
        setPostError((err && err.error) || "fail");
      });
  }

  function submitPost(e) {
    e.preventDefault();
    savePost(false, true);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var openBtn = $("[data-post-create]");
    var modal = $("[data-post-modal]");
    var form = $("[data-post-form]");
    var closeBtn = $("[data-post-close]");
    var photoBtn = $("[data-photo-btn]");
    var photoInput = $("[data-photo-input]");
    var confirmBox = $("[data-confirm-modal]");
    var commentEdit = $("[data-comment-edit]");
    if (commentEdit) {
      commentEdit.addEventListener("focus", function () { lastEdit = commentEdit; });
      commentEdit.addEventListener("input", syncCommentCount);
      commentEdit.addEventListener("beforeinput", function (e) {
        if (!e.data) return;
        if (commentLen() + String(e.data).length > COMMENT_MAX) e.preventDefault();
      });
    }
    var commentClose = $("[data-comment-close]");
    if (commentClose) commentClose.addEventListener("click", hideComments);
    var commentSend = $("[data-comment-send]");
    if (commentSend) commentSend.addEventListener("click", sendComment);
    var commentModal = $("[data-comment-modal]");
    if (commentModal) {
      commentModal.addEventListener("click", function (e) {
        if (e.target === commentModal) hideComments();
      });
    }
    fillVersionBoxes();
    syncFormKind();

    document.querySelectorAll("[data-feed-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        feedKind = btn.getAttribute("data-feed-tab") === "publication" ? "publication" : "project";
        document.querySelectorAll("[data-feed-tab]").forEach(function (other) {
          other.classList.toggle("is-active", other === btn);
        });
        if (form && form.kind) {
          form.kind.value = feedKind;
          syncFormKind();
        }
        renderPosts(lastPosts);
      });
    });

    document.querySelectorAll("[data-post-lang]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setPostLang(btn.getAttribute("data-post-lang"));
      });
    });

    document.querySelectorAll("[data-editor], [data-lead]").forEach(function (box) {
      box.addEventListener("keyup", function () {
        skipFmtSync = false;
        saveSel();
        syncFmtButtons();
      });
      box.addEventListener("mouseup", function () {
        skipFmtSync = false;
        saveSel();
        syncFmtButtons();
      });
      box.addEventListener("focus", function () {
        lastEdit = box;
        saveSel();
      });
      box.addEventListener("click", function (e) {
        var a = e.target.closest("a");
        if (a && box.contains(a)) e.preventDefault();
      });
    });

    var dialog = document.querySelector(".post-dialog");
    if (dialog) {
      dialog.addEventListener("mousedown", function (e) {
        var btn = e.target.closest("button");
        if (!btn || !dialog.contains(btn)) return;
        if (btn.closest(".post-toolbar, .post-lead-bar")) e.preventDefault();
        if (btn.closest("[data-link-btn]")) {
          saveSel();
          snapshotLinkRange();
        }
        if (window.dandelionClick) window.dandelionClick();
      });
    }

    document.querySelectorAll("[data-fmt]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyFmt(btn.getAttribute("data-fmt"));
      });
    });
    document.querySelectorAll("[data-link-btn]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        saveSel();
        snapshotLinkRange();
        var pop = $("[data-link-pop]");
        var already = pop && !pop.hidden && btn.classList.contains("is-on");
        setLinkOpen(!already, btn);
      });
    });
    var linkInput = $("[data-link-input]");
    if (linkInput) {
      linkInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          applyLink(linkInput.value);
          setLinkOpen(false);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setLinkOpen(false);
        }
      });
    }
    document.addEventListener("click", function (e) {
      var pop = $("[data-link-pop]");
      if (!pop || pop.hidden) return;
      if (pop.contains(e.target) || e.target.closest("[data-link-btn]")) return;
      var href = linkInput ? String(linkInput.value || "").trim() : "";
      if (href) applyLink(href);
      setLinkOpen(false);
    });
    document.addEventListener("selectionchange", syncFmtButtons);

    document.querySelectorAll("[data-color]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setWriteColor(btn.getAttribute("data-color"));
        applyFmt("foreColor", rgbColor());
      });
    });

    document.querySelectorAll("[data-post-kind]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (editingId) return;
        if (form && form.kind) form.kind.value = btn.getAttribute("data-post-kind");
        syncFormKind();
      });
    });

    document.querySelectorAll("[data-rgb]").forEach(function (input) {
      input.addEventListener("pointerdown", saveSel);
      input.addEventListener("input", function () {
        hsvFromSliders();
        syncRgbPreview();
        applyColorLive();
      });
    });
    var pick = $("[data-rgb-pick]");
    if (pick) {
      pick.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        saveSel();
        var wrap = $("[data-rgb-pick-wrap]");
        setPickerOpen(!(wrap && wrap.classList.contains("is-open")));
      });
    }
    function bindPickerDrag(canvas, handler) {
      if (!canvas) return;
      canvas.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        saveSel();
        canvas.setPointerCapture(e.pointerId);
        handler(e);
      });
      canvas.addEventListener("pointermove", function (e) {
        if (!canvas.hasPointerCapture(e.pointerId)) return;
        handler(e);
      });
    }
    bindPickerDrag($("[data-rgb-sv-canvas]"), function (e) {
      var canvas = $("[data-rgb-sv-canvas]");
      if (!canvas) return;
      var rect = canvas.getBoundingClientRect();
      pickS = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      pickV = 1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      applyHsvToRgb();
    });
    bindPickerDrag($("[data-rgb-hue-canvas]"), function (e) {
      var canvas = $("[data-rgb-hue-canvas]");
      if (!canvas) return;
      var rect = canvas.getBoundingClientRect();
      pickH = Math.min(359, Math.max(0, ((e.clientY - rect.top) / rect.height) * 360));
      applyHsvToRgb();
    });
    document.addEventListener("click", function (e) {
      var wrap = $("[data-rgb-pick-wrap]");
      if (!wrap || !wrap.classList.contains("is-open")) return;
      if (wrap.contains(e.target)) return;
      setPickerOpen(false);
    });
    var rgbApply = $("[data-rgb-apply]");
    if (rgbApply) {
      rgbApply.addEventListener("click", function () {
        applyFmt("foreColor", rgbColor());
      });
    }
    var hex = $("[data-rgb-hex]");
    if (hex) {
      hex.addEventListener("focus", saveSel);
      hex.addEventListener("input", function () {
        var parsed = parseHex(hex.value);
        if (!parsed) return;
        var r = $('[data-rgb="r"]');
        var g = $('[data-rgb="g"]');
        var b = $('[data-rgb="b"]');
        if (r) r.value = parsed.r;
        if (g) g.value = parsed.g;
        if (b) b.value = parsed.b;
        hsvFromSliders();
        syncRgbPreview();
        applyColorLive();
      });
    }
    syncRgbPreview();

    if (photoBtn && photoInput) {
      photoBtn.addEventListener("click", function () {
        saveSel();
        photoInput.value = "";
        photoInput.click();
      });
      photoInput.addEventListener("change", function () {
        if (photoInput.files && photoInput.files[0]) insertPhoto(photoInput.files[0]);
      });
    }

    var previewBtn = $("[data-preview-btn]");
    var previewInput = $("[data-preview-input]");
    if (previewBtn && previewInput) {
      previewBtn.addEventListener("click", function () {
        previewInput.value = "";
        previewInput.click();
      });
      previewInput.addEventListener("change", function () {
        if (!previewInput.files || !previewInput.files[0]) return;
        var file = previewInput.files[0];
        cropSquare(file)
          .then(function (photo) {
            photo.name = file.name || "";
            setPreview(photo);
            setPostError("");
          })
          .catch(function (err) {
            setPostError((err && err.error) || "fail");
          });
      });
    }

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        editingId = null;
        resetEditor();
        if (form && form.kind) form.kind.value = activeKind();
        syncFormKind();
        openPostModal();
        openSnapshot = formSnapshot();
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", requestClose);
    if (form) {
      form.addEventListener("submit", submitPost);
      form.addEventListener("pointerdown", guardLiveView, true);
      form.addEventListener("keydown", guardLiveView, true);
      form.addEventListener("paste", guardLiveView, true);
    }
    document.querySelectorAll("[data-post-eye]").forEach(function (eyeBtn) {
      eyeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!editingId || editingWasDraft) return;
        setLivePreview(!viewingLive);
      });
    });
    var saveBtn = $("[data-post-save]");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        savePost(true, true);
      });
    }
    var closeAsk = $("[data-close-modal]");
    var closeDiscard = $("[data-close-discard]");
    var closeSave = $("[data-close-save]");
    if (closeDiscard) {
      closeDiscard.addEventListener("click", function () {
        hideCloseAsk();
        forceClosePostModal();
      });
    }
    if (closeSave) {
      closeSave.addEventListener("click", function () {
        hideCloseAsk();
        savePost(true, true);
      });
    }
    if (closeAsk) {
      closeAsk.addEventListener("click", function (e) {
        if (e.target === closeAsk) hideCloseAsk();
      });
    }

    if (confirmBox) {
      var yes = $("[data-confirm-yes]");
      var no = $("[data-confirm-no]");
      if (yes) {
        yes.addEventListener("click", function () {
          var fn = confirmFn;
          hideConfirm();
          if (fn) fn();
        });
      }
      if (no) no.addEventListener("click", hideConfirm);
      confirmBox.addEventListener("click", function (e) {
        if (e.target === confirmBox) hideConfirm();
      });
    }

    document.addEventListener("click", closeMenus);

    var prev = window.applyI18n;
    if (typeof prev === "function") {
      window.applyI18n = function () {
        prev();
        syncSubmitLabel();
        loadPosts();
      };
    }

    if (window.DandelionAuth && window.DandelionAuth.onChange) {
      window.DandelionAuth.onChange(function () {
        if (window.DandelionAuth && !window.DandelionAuth.isAdmin()) forceClosePostModal();
        loadPosts();
      });
    }

    if (document.body.getAttribute("data-page") === "project") {
      var params = new URLSearchParams(window.location.search);
      var pid = params.get("id") || "";
      var titleEl = $("[data-project-title]");
      if (pid) {
        var tok = token();
        rpc("get_post", tok ? { p_token: tok, p_id: pid } : { p_token: null, p_id: pid })
          .then(function (data) {
            var post = data && data.post;
            if (!post || postKind(post) !== "project") return;
            var name = post.title_en || post.title_ua || "";
            if (titleEl) titleEl.textContent = name;
            if (name) document.title = name + " — Dandelion_ua";
          })
          .catch(function () {});
      }
    }

    loadPosts();
  });
})();
