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

  function openPostModal() {
    var modal = $("[data-post-modal]");
    if (!modal) return;
    modal.hidden = false;
    setPostError("");
    if (typeof window.applyI18n === "function") applyI18n();
  }

  function closePostModal() {
    var modal = $("[data-post-modal]");
    var form = $("[data-post-form]");
    if (modal) modal.hidden = true;
    setPostError("");
    editingId = null;
    if (form) form.reset();
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
      if (body) {
        var p = document.createElement("p");
        p.className = "post-body";
        p.textContent = body;
        article.appendChild(p);
      }
      if (post.photos && post.photos.length) {
        var gallery = document.createElement("div");
        gallery.className = "post-photos";
        post.photos.forEach(function (photo) {
          if (!photo || !photo.data || !photo.mime) return;
          var img = document.createElement("img");
          img.src = "data:" + photo.mime + ";base64," + photo.data;
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
    form.body_en.value = post.body_en || "";
    form.body_ua.value = post.body_ua || "";
    form.photos.value = "";
    openPostModal();
  }

  function askDelete(postId) {
    if (!window.confirm(t("post_delete_confirm"))) return;
    rpc("delete_post", { p_token: token(), p_id: postId })
      .then(function (data) {
        if (data && data.ok) loadPosts();
      })
      .catch(function () {});
  }

  function readFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || [], 0, MAX_PHOTOS);
    var jobs = files.map(function (file) {
      return new Promise(function (resolve, reject) {
        if (file.size > MAX_BYTES) {
          reject({ error: "photo_big" });
          return;
        }
        if (["image/jpeg", "image/png", "image/webp", "image/gif"].indexOf(file.type) === -1) {
          reject({ error: "photo_type" });
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var text = String(reader.result || "");
          var comma = text.indexOf(",");
          resolve({
            mime: file.type,
            data: comma >= 0 ? text.slice(comma + 1) : text
          });
        };
        reader.onerror = function () {
          reject({ error: "fail" });
        };
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(jobs);
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
    var bodyEn = (form.body_en.value || "").trim();
    var bodyUa = (form.body_ua.value || "").trim();
    if (!titleEn && !titleUa) {
      setPostError("empty_post");
      return;
    }
    setPostError("");
    var files = form.photos.files;
    var photosPromise = files && files.length ? readFiles(files) : Promise.resolve(editingId ? null : []);
    photosPromise
      .then(function (photos) {
        var payload = {
          p_token: auth,
          p_title_en: titleEn,
          p_title_ua: titleUa,
          p_body_en: bodyEn,
          p_body_ua: bodyUa,
          p_photos: photos,
          p_kind: kind
        };
        if (editingId) payload.p_id = editingId;
        var name = editingId ? "update_post" : "create_post";
        if (!editingId && !payload.p_photos) payload.p_photos = [];
        return rpc(name, payload).catch(function () {
          delete payload.p_kind;
          return rpc(name, payload);
        });
      })
      .then(function (data) {
        if (!data || !data.ok) {
          setPostError((data && data.error) || "fail");
          return;
        }
        form.reset();
        closePostModal();
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

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        editingId = null;
        if (form) form.reset();
        if (form && form.kind) form.kind.value = activeKind();
        openPostModal();
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", closePostModal);
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closePostModal();
      });
    }
    if (form) form.addEventListener("submit", submitPost);

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
        if (window.DandelionAuth && !window.DandelionAuth.isAdmin()) closePostModal();
        loadPosts();
      });
    }

    loadPosts();
  });
})();
