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

  function formMode() {
    var form = $("[data-account-form]");
    return form && form.getAttribute("data-account-mode") === "register" ? "register" : "login";
  }

  function setFormMode(mode) {
    var next = mode === "register" ? "register" : "login";
    var form = $("[data-account-form]");
    var submit = $("[data-account-submit]");
    var key = next === "register" ? "account_create" : "account_login";
    if (form) form.setAttribute("data-account-mode", next);
    document.querySelectorAll("[data-account-tab]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-account-tab") === next);
    });
    if (submit) {
      submit.setAttribute("data-i18n", key);
      submit.textContent = t(key);
    }
    if (form && form.password) {
      form.password.setAttribute("autocomplete", next === "register" ? "new-password" : "current-password");
    }
  }

  function paint() {
    var label = $("[data-account-label]");
    var dialog = document.querySelector(".account-dialog");
    var formBox = $("[data-account-form-box]");
    var sessionBox = $("[data-account-session]");
    var sessionNick = $("[data-account-session-nick]");
    var nickEdit = $("[data-account-nick-edit]");
    var nickOpen = $("[data-account-nick-open]");
    if (label) label.textContent = nick ? nick : t("account_guest");
    if (dialog) dialog.setAttribute("data-account-view", nick ? "session" : "guest");
    if (formBox) formBox.hidden = Boolean(nick);
    if (sessionBox) sessionBox.hidden = !nick;
    if (sessionNick) sessionNick.textContent = nick;
    if (nickEdit) nickEdit.hidden = true;
    if (nickOpen) nickOpen.hidden = false;
    setFormMode(formMode());
    document.querySelectorAll("[data-admin-only]").forEach(function (el) {
      el.hidden = !isAdmin;
    });
  }

  function setError(code) {
    var el = $("[data-account-error]");
    if (!el) return;
    el.textContent = code ? t("err_" + code) : "";
  }

  function setToggleOpen(open) {
    var toggle = $("[data-account-toggle]");
    if (!toggle) return;
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function openModal() {
    var modal = $("[data-account-modal]");
    if (!modal) return;
    modal.hidden = false;
    setToggleOpen(true);
    setError("");
    if (!nick) setFormMode("login");
    if (typeof window.applyI18n === "function") applyI18n();
    else paint();
  }

  function closeModal() {
    var modal = $("[data-account-modal]");
    var nickEdit = $("[data-account-nick-edit]");
    var nickOpen = $("[data-account-nick-open]");
    if (!modal) return;
    modal.hidden = true;
    setToggleOpen(false);
    setError("");
    if (nickEdit) nickEdit.hidden = true;
    if (nickOpen) nickOpen.hidden = false;
  }

  function fields() {
    var form = $("[data-account-form]");
    if (!form) return { nick: "", password: "", password2: "" };
    return {
      nick: (form.nick.value || "").trim(),
      password: form.password ? form.password.value || "" : "",
      password2: form.password2 ? form.password2.value || "" : ""
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
    if (f.password !== f.password2) {
      setError("password_match");
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
    var outBtn = $("[data-account-logout]");
    var closeBtn = $("[data-account-close]");
    var nickOpen = $("[data-account-nick-open]");
    var nickSave = $("[data-account-nick-save]");
    if (toggle) {
      toggle.addEventListener("click", function () {
        if (modal && !modal.hidden) closeModal();
        else openModal();
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
      });
    }
    document.querySelectorAll("[data-account-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setError("");
        setFormMode(btn.getAttribute("data-account-tab"));
      });
    });
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (formMode() === "register") register();
        else login();
      });
    }
    if (nickOpen) {
      nickOpen.addEventListener("click", function () {
        var box = $("[data-account-nick-edit]");
        var input = $("[data-account-new-nick]");
        if (box) box.hidden = false;
        nickOpen.hidden = true;
        if (input) {
          input.value = nick;
          input.focus();
        }
      });
    }
    if (nickSave) {
      nickSave.addEventListener("click", function () {
        var input = $("[data-account-new-nick]");
        var next = input ? (input.value || "").trim() : "";
        if (!nickOk(next)) {
          setError("bad_nick");
          return;
        }
        if (next === nick) {
          paint();
          return;
        }
        rpc("account_rename", { p_token: token, p_nick: next })
          .then(function (data) {
            if (!data || !data.ok) {
              setError((data && data.error) || "fail");
              return;
            }
            nick = data.nick || next;
            paint();
            authListeners.forEach(function (fn) {
              try { fn(); } catch (e) {}
            });
          })
          .catch(function (err) {
            setError((err && err.error) || "fail");
          });
      });
    }
    if (outBtn) outBtn.addEventListener("click", logout);

    document.querySelectorAll("[data-pass-eye]").forEach(function (btn) {
      var row = btn.closest(".pass-row");
      var input = row ? row.querySelector("input") : null;
      function show() {
        if (input) input.type = "text";
      }
      function hide() {
        if (input) input.type = "password";
      }
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        show();
      });
      btn.addEventListener("mouseup", hide);
      btn.addEventListener("mouseleave", hide);
      btn.addEventListener("touchstart", function (e) {
        e.preventDefault();
        show();
      }, { passive: false });
      btn.addEventListener("touchend", hide);
      btn.addEventListener("touchcancel", hide);
    });

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
