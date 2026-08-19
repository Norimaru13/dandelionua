/**
 * Перегляди і вподобайки.
 * Працює через server.py (спільні цифри).
 * Якщо сервера немає — лише цей браузер, localStorage.
 */
(function () {
  var PAGE = document.body.getAttribute("data-page-id");
  if (!PAGE) return;

  var VISITOR_KEY = "dandelion-visitor";
  var LOCAL_KEY = "dandelion-stats";

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

  function localAll() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function localPage() {
    var all = localAll();
    if (!all[PAGE]) {
      all[PAGE] = { views: 0, likes: 0, viewed: false, liked: false };
    }
    return { all: all, page: all[PAGE] };
  }

  function saveLocal(all) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  }

  function render(state) {
    var likeCount = document.querySelector("[data-like-count]");
    var viewCount = document.querySelector("[data-view-count]");
    var likeBtn = document.querySelector("[data-like]");
    if (likeCount) likeCount.textContent = state.likes;
    if (viewCount) viewCount.textContent = state.views;
    if (likeBtn) likeBtn.classList.toggle("is-liked", Boolean(state.liked));
  }

  function api(path, body) {
    return fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Visitor-Id": visitorId()
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error("api");
      return res.json();
    });
  }

  function viewLocal() {
    var pack = localPage();
    if (!pack.page.viewed) {
      pack.page.viewed = true;
      pack.page.views += 1;
      saveLocal(pack.all);
    }
    return pack.page;
  }

  function toggleLikeLocal() {
    var pack = localPage();
    if (pack.page.liked) {
      pack.page.liked = false;
      pack.page.likes = Math.max(0, pack.page.likes - 1);
    } else {
      pack.page.liked = true;
      pack.page.likes += 1;
    }
    saveLocal(pack.all);
    return pack.page;
  }

  document.addEventListener("DOMContentLoaded", function () {
    api("/api/view", { page: PAGE }).then(render).catch(function () {
      render(viewLocal());
    });

    var likeBtn = document.querySelector("[data-like]");
    if (!likeBtn) return;

    likeBtn.addEventListener("click", function () {
      api("/api/like", { page: PAGE }).then(render).catch(function () {
        render(toggleLikeLocal());
      });
    });
  });
})();
