/**
 * Публікації: список, адмін-меню, лайки і перегляди.
 */
(function () {
  var MAX_PHOTOS = 4;
  var MAX_BYTES = 600000;
  var VISITOR_KEY = "dandelion-visitor";
  var editingId = null;
  var lastPosts = [];
  var feedKind = "project";
  var savedRange = null;
  var confirmFn = null;
  var closeTimer = 0;

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
    var out = (list || []).filter(function (post) {
      return postKind(post) === kind;
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
    var pane = $(".post-pane.is-on");
    if (!pane) return editor("en");
    return pane.querySelector("[data-editor]");
  }

  function setPostLang(lang) {
    var next = lang === "ua" ? "ua" : "en";
    document.querySelectorAll("[data-post-lang]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-post-lang") === next);
    });
    document.querySelectorAll("[data-post-pane]").forEach(function (pane) {
      pane.classList.toggle("is-on", pane.getAttribute("data-post-pane") === next);
    });
  }

  function saveSel() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var node = sel.anchorNode;
    var box = activeEditor();
    if (!box || !node || !box.contains(node.nodeType === 1 ? node : node.parentNode)) return;
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

  function applyFmt(cmd, val) {
    restoreSel();
    try {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand(cmd, false, val || null);
    } catch (e) {}
    saveSel();
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
    var allow = { b: 1, i: 1, u: 1, strong: 1, em: 1, span: 1, font: 1, br: 1, p: 1, div: 1, img: 1 };

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

  function resetEditor() {
    var form = $("[data-post-form]");
    if (form) form.reset();
    fillEditors(null);
    setPostError("");
    var rgb = $("[data-rgb-box]");
    if (rgb) rgb.hidden = true;
    setPostLang(typeof getLang === "function" && getLang() === "ua" ? "ua" : "en");
  }

  function openPostModal() {
    var modal = $("[data-post-modal]");
    if (!modal) return;
    window.clearTimeout(closeTimer);
    modal.hidden = false;
    setPostError("");
    if (typeof window.applyI18n === "function") applyI18n();
    window.requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });
  }

  function forceClosePostModal() {
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
    box.hidden = false;
    if (typeof window.applyI18n === "function") applyI18n();
    text.textContent = message;
  }

  function hideConfirm() {
    var box = $("[data-confirm-modal]");
    if (box) box.hidden = true;
    confirmFn = null;
  }

  function requestClose() {
    askConfirm(t("post_close_confirm"), function () {
      forceClosePostModal();
    });
  }

  function heartSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.7-4.35-9.33-8.5C.5 9.5 1.5 5.5 5 4.2 7.1 3.4 9.4 4 12 6.2 14.6 4 16.9 3.4 19 4.2c3.5 1.3 4.5 5.3 2.33 8.3C18.7 16.65 12 21 12 21z"/></svg>';
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

      if (admin) {
        var tools = document.createElement("div");
        tools.className = "post-tools";
        var dots = document.createElement("button");
        dots.type = "button";
        dots.className = "post-dots";
        dots.textContent = "⋯";
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

      var title = lang === "ua" ? (post.title_ua || post.title_en) : (post.title_en || post.title_ua);
      var lead = lang === "ua" ? (post.lead_ua || post.lead_en) : (post.lead_en || post.lead_ua);
      var body = lang === "ua" ? (post.body_ua || post.body_en) : (post.body_en || post.body_ua);
      var when = formatWhen(post.created_at);
      if (when) {
        var time = document.createElement("p");
        time.className = "post-when";
        time.textContent = when;
        article.appendChild(time);
      }
      if (title) {
        var h = document.createElement("h2");
        h.className = "post-title";
        h.textContent = title;
        article.appendChild(h);
      }
      if (lead) {
        var leadEl = document.createElement("p");
        leadEl.className = "post-lead";
        leadEl.textContent = lead;
        article.appendChild(leadEl);
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
        article.appendChild(p);
      }

      var used = usedPhotoIndexes(looksHtml(body) ? body : "");
      var leftovers = (post.photos || []).filter(function (photo, i) {
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
        article.appendChild(gallery);
      }

      var react = document.createElement("div");
      react.className = "post-react";
      react.innerHTML =
        '<span class="post-views">' + eyeSvg() + '<span data-view-count>' + (post.views || 0) + "</span></span>" +
        '<button type="button" class="like-btn' + (post.liked ? " is-liked" : "") + '" data-post-like>' +
        heartSvg() + '<span data-like-count>' + (post.likes || 0) + "</span></button>";
      react.querySelector("[data-post-like]").addEventListener("click", function () {
        toggleLike(post.id, article);
      });
      article.appendChild(react);

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
      rpc("record_post_view", { p_post: post.id, p_visitor: visitor })
        .then(function (data) {
          if (!data || !data.ok) return;
          var el = document.querySelector('[data-post-id="' + post.id + '"] [data-view-count]');
          if (el) el.textContent = data.views;
        })
        .catch(function () {});
    });
  }

  function toggleLike(postId, article) {
    if (!token()) {
      if (window.DandelionAuth && window.DandelionAuth.openLogin) {
        window.DandelionAuth.openLogin();
      }
      return;
    }
    rpc("toggle_post_like", { p_post: postId, p_token: token() })
      .then(function (data) {
        if (!data || !data.ok) {
          if (data && data.error === "auth" && window.DandelionAuth && window.DandelionAuth.openLogin) {
            window.DandelionAuth.openLogin();
          }
          return;
        }
        var btn = article.querySelector("[data-post-like]");
        var count = article.querySelector("[data-like-count]");
        if (btn) btn.classList.toggle("is-liked", Boolean(data.liked));
        if (count) count.textContent = data.likes;
      })
      .catch(function () {});
  }

  function startEdit(post) {
    var form = $("[data-post-form]");
    if (!form) return;
    editingId = post.id;
    form.kind.value = postKind(post);
    form.title_en.value = post.title_en || "";
    form.title_ua.value = post.title_ua || "";
    if (form.lead_en) form.lead_en.value = post.lead_en || "";
    if (form.lead_ua) form.lead_ua.value = post.lead_ua || "";
    fillEditors(post);
    setPostLang(typeof getLang === "function" && getLang() === "ua" ? "ua" : "en");
    openPostModal();
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

  function syncRgbPreview() {
    var preview = $("[data-rgb-apply]");
    if (preview) preview.style.background = rgbColor();
  }

  function insertPhoto(file) {
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

  function submitPost(e) {
    e.preventDefault();
    var form = e.target;
    var auth = token();
    if (!auth) {
      setPostError("auth");
      return;
    }
    var kind = form.kind && form.kind.value === "publication" ? "publication" : "project";
    var titleEn = (form.title_en.value || "").trim();
    var titleUa = (form.title_ua.value || "").trim();
    var leadEn = form.lead_en ? (form.lead_en.value || "").trim() : "";
    var leadUa = form.lead_ua ? (form.lead_ua.value || "").trim() : "";
    if (!titleEn && !titleUa) {
      setPostError("empty_post");
      return;
    }
    var packed = packBodies();
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
      p_lead_ua: leadUa
    };
    if (editingId) payload.p_id = editingId;
    var name = editingId ? "update_post" : "create_post";
    rpc(name, payload)
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
        forceClosePostModal();
        loadPosts();
      })
      .catch(function (err) {
        setPostError((err && err.error) || "fail");
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var openBtn = $("[data-post-create]");
    var modal = $("[data-post-modal]");
    var form = $("[data-post-form]");
    var closeBtn = $("[data-post-close]");
    var photoBtn = $("[data-photo-btn]");
    var photoInput = $("[data-photo-input]");
    var rgbBox = $("[data-rgb-box]");
    var confirmBox = $("[data-confirm-modal]");

    document.querySelectorAll("[data-feed-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        feedKind = btn.getAttribute("data-feed-tab") === "publication" ? "publication" : "project";
        document.querySelectorAll("[data-feed-tab]").forEach(function (other) {
          other.classList.toggle("is-active", other === btn);
        });
        if (form && form.kind) form.kind.value = feedKind;
        renderPosts(lastPosts);
      });
    });

    document.querySelectorAll("[data-post-lang]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setPostLang(btn.getAttribute("data-post-lang"));
      });
    });

    document.querySelectorAll("[data-editor]").forEach(function (box) {
      box.addEventListener("keyup", saveSel);
      box.addEventListener("mouseup", saveSel);
      box.addEventListener("focus", saveSel);
    });

    var toolbar = $(".post-toolbar");
    if (toolbar) {
      toolbar.addEventListener("mousedown", function (e) {
        if (e.target.closest("button")) e.preventDefault();
      });
    }

    document.querySelectorAll("[data-fmt]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyFmt(btn.getAttribute("data-fmt"));
      });
    });

    document.querySelectorAll("[data-color]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyFmt("foreColor", btn.getAttribute("data-color"));
      });
    });

    var rgbToggle = $("[data-rgb-toggle]");
    if (rgbToggle && rgbBox) {
      rgbToggle.addEventListener("click", function () {
        rgbBox.hidden = !rgbBox.hidden;
        syncRgbPreview();
      });
    }
    document.querySelectorAll("[data-rgb]").forEach(function (input) {
      input.addEventListener("input", syncRgbPreview);
    });
    var rgbApply = $("[data-rgb-apply]");
    if (rgbApply) {
      rgbApply.addEventListener("click", function () {
        applyFmt("foreColor", rgbColor());
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

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        editingId = null;
        resetEditor();
        if (form && form.kind) form.kind.value = activeKind();
        openPostModal();
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", requestClose);
    if (form) form.addEventListener("submit", submitPost);

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
        loadPosts();
      };
    }

    if (window.DandelionAuth && window.DandelionAuth.onChange) {
      window.DandelionAuth.onChange(function () {
        if (window.DandelionAuth && !window.DandelionAuth.isAdmin()) forceClosePostModal();
        loadPosts();
      });
    }

    loadPosts();
  });
})();
