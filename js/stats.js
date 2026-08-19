/**
 * Перегляди і вподобайки.
 * 1) Supabase — спільні цифри для всіх (після налаштування).
 * 2) Якщо Supabase ще порожній — localStorage, лише цей браузер.
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

  function supabaseClient() {
    var cfg = window.DANDELION_SUPABASE || {};
    if (!cfg.url || !cfg.anonKey || !window.supabase) return null;
    return window.supabase.createClient(cfg.url, cfg.anonKey);
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

  function recordView() {
    var db = supabaseClient();
    if (!db) {
      render(viewLocal());
      return Promise.resolve();
    }
    return db.rpc("record_view", { p_page: PAGE, p_visitor: visitorId() }).then(function (res) {
      if (res.error) throw res.error;
      render(res.data);
    }).catch(function () {
      render(viewLocal());
    });
  }

  function toggleLike() {
    var db = supabaseClient();
    if (!db) {
      render(toggleLikeLocal());
      return Promise.resolve();
    }
    return db.rpc("toggle_like", { p_page: PAGE, p_visitor: visitorId() }).then(function (res) {
      if (res.error) throw res.error;
      render(res.data);
    }).catch(function () {
      render(toggleLikeLocal());
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    recordView();
    var likeBtn = document.querySelector("[data-like]");
    if (likeBtn) likeBtn.addEventListener("click", toggleLike);
  });
})();
