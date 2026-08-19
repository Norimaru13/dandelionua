/**
 * Профіль: нік + пароль через Supabase RPC.
 * Лайки тільки з валідною сесією.
 */
(function () {
  var TOKEN_KEY = "dandelion-session";
  var token = localStorage.getItem(TOKEN_KEY) || "";
  var nick = "";
  var isAdmin = false;
  var authListeners = [];

  function cfg() {
    return window.DANDELION_SUPABASE || {};
  }

  function rpc(name, body) {
    var c = cfg();
    if (!c.url || !c.anonKey) {
      return Promise.reject({ error: "no_db" });
    }
    return fetch(c.url + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: {
        apikey: c.anonKey,
        Authorization: "Bearer " + c.anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = { error: "fail", message: text };
          }
        }
        if (!res.ok) {
          if (res.status === 404) throw { error: "need_sql" };
          throw data || { error: "fail" };
        }
        return data;
      });
    });
  }

  function nickOk(value) {
    return /^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9_.-]{3,20}$/.test(value);
  }

  function setSession(nextToken, nextNick, nextAdmin) {
    token = nextToken || "";
    nick = nextNick || "";
    isAdmin = Boolean(nextAdmin);
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    paint();
    authListeners.forEach(function (fn) {
      try { fn(); } catch (e) {}
    });
  }

  function $(sel) {
    return document.querySelector(sel);
  }

  function paint() {
    var label = $("[data-account-label]");
    var modal = $("[data-account-modal]");
    var formBox = $("[data-account-form-box]");
    var sessionBox = $("[data-account-session]");
    var sessionNick = $("[data-account-session-nick]");
    if (label) label.textContent = nick ? nick : t("account_enter");
    if (formBox) formBox.hidden = Boolean(nick);
    if (sessionBox) sessionBox.hidden = !nick;
    if (sessionNick) sessionNick.textContent = nick;
    document.querySelectorAll("[data-admin-only]").forEach(function (el) {
      el.hidden = !isAdmin;
    });
  }

  function setError(code) {
    var el = $("[data-account-error]");
    if (!el) return;
    el.textContent = code ? t("err_" + code) : "";
  }

  function openModal() {
    var modal = $("[data-account-modal]");
    if (!modal) return;
    modal.hidden = false;
    setError("");
    if (typeof window.applyI18n === "function") applyI18n();
    else paint();
  }

  function closeModal() {
    var modal = $("[data-account-modal]");
    if (!modal) return;
    modal.hidden = true;
    setError("");
  }

  function fields() {
    var form = $("[data-account-form]");
    if (!form) return { nick: "", password: "" };
    return {
      nick: (form.nick.value || "").trim(),
      password: form.password.value || ""
    };
  }

  function afterAuth(data) {
    if (!data || !data.ok) {
      setError((data && data.error) || "fail");
      return;
    }
    setSession(data.token, data.nick, data.is_admin);
    closeModal();
  }

  function register() {
    var f = fields();
    if (!nickOk(f.nick)) {
      setError("bad_nick");
      return;
    }
    if (f.password.length < 6) {
      setError("bad_password");
      return;
    }
    rpc("account_register", { p_nick: f.nick, p_password: f.password })
      .then(afterAuth)
      .catch(function (err) {
        setError((err && err.error) || "fail");
      });
  }

  function login() {
    var f = fields();
    rpc("account_login", { p_nick: f.nick, p_password: f.password })
      .then(afterAuth)
      .catch(function (err) {
        setError((err && err.error) || "fail");
      });
  }

  function logout() {
    var current = token;
    setSession("", "");
    closeModal();
    if (current) rpc("account_logout", { p_token: current }).catch(function () {});
  }

  function restore() {
    if (!token) {
      paint();
      return;
    }
    rpc("account_me", { p_token: token })
      .then(function (data) {
        if (data && data.ok) {
          nick = data.nick;
          isAdmin = Boolean(data.is_admin);
        } else setSession("", "");
        paint();
        authListeners.forEach(function (fn) {
          try { fn(); } catch (e) {}
        });
      })
      .catch(function () {
        paint();
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = $("[data-account-toggle]");
    var modal = $("[data-account-modal]");
    var form = $("[data-account-form]");
    var regBtn = $("[data-account-register]");
    var outBtn = $("[data-account-logout]");
    var closeBtn = $("[data-account-close]");
    if (toggle) toggle.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
      });
    }
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        login();
      });
    }
    if (regBtn) {
      regBtn.addEventListener("click", function () {
        register();
      });
    }
    if (outBtn) outBtn.addEventListener("click", logout);

    var prev = window.applyI18n;
    if (typeof prev === "function") {
      window.applyI18n = function () {
        prev();
        paint();
      };
    }

    restore();
  });

  window.DandelionAuth = {
    token: function () { return token; },
    isAdmin: function () { return isAdmin; },
    openLogin: openModal,
    onChange: function (fn) {
      if (typeof fn === "function") authListeners.push(fn);
    }
  };
  window.dandelionRpc = rpc;
})();
