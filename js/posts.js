/**
 * Публікації на головній. Створює лише адмін.
 */
(function () {
  var MAX_PHOTOS = 4;
  var MAX_BYTES = 600000;

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
    if (!modal) return;
    modal.hidden = true;
    setPostError("");
  }

  function renderPosts(list) {
    var box = $("[data-posts]");
    if (!box) return;
    box.innerHTML = "";
    if (!list || !list.length) return;
    var lang = typeof getLang === "function" ? getLang() : "en";
    list.forEach(function (post) {
      var article = document.createElement("article");
      article.className = "post";
      var title = lang === "ua" ? (post.title_ua || post.title_en) : (post.title_en || post.title_ua);
      var body = lang === "ua" ? (post.body_ua || post.body_en) : (post.body_en || post.body_ua);
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
      box.appendChild(article);
    });
  }

  function loadPosts() {
    rpc("list_posts", {})
      .then(function (data) {
        if (data && data.ok) renderPosts(data.posts || []);
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
    var titleEn = (form.title_en.value || "").trim();
    var titleUa = (form.title_ua.value || "").trim();
    var bodyEn = (form.body_en.value || "").trim();
    var bodyUa = (form.body_ua.value || "").trim();
    if (!titleEn && !titleUa) {
      setPostError("empty_post");
      return;
    }
    setPostError("");
    readFiles(form.photos.files)
      .then(function (photos) {
        return rpc("create_post", {
          p_token: auth,
          p_title_en: titleEn,
          p_title_ua: titleUa,
          p_body_en: bodyEn,
          p_body_ua: bodyUa,
          p_photos: photos
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

    if (openBtn) openBtn.addEventListener("click", openPostModal);
    if (closeBtn) closeBtn.addEventListener("click", closePostModal);
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closePostModal();
      });
    }
    if (form) form.addEventListener("submit", submitPost);

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
      });
    }

    loadPosts();
  });
})();
