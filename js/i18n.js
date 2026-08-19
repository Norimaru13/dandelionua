/**
 * Мова сайту.
 * Тексти додаю тільки коли власник їх дає українською —
 * тоді сюди йде український оригінал і англійський переклад.
 */
var LANG_KEY = "dandelion-lang";

var translations = {
  en: {
    intro: "I am Dandelion, a Ukrainian modder focused on atmospheric mechanics, small details, and captivating gameplay.",
    intro2: "I create mods, data packs, and resource packs for Minecraft Java Edition, mostly working on mod loaders such as Fabric and NeoForge, occasionally Forge. Do I plan to expand toward Bedrock Edition? I don't see a reason for that yet, but it all depends on the future community and its needs.",
    versions_title: "Supported versions:",
    col_datapacks: "data packs",
    col_resourcepacks: "resource packs",
    footer: "site created by Norimaru, based on Dandelion's idea",
    account_enter: "log in",
    account_nick: "nick",
    account_password: "password",
    account_login: "log in",
    account_register: "create profile",
    account_logout: "log out",
    account_close: "close",
    err_taken: "this nick is already taken",
    err_bad_login: "wrong nick or password",
    err_bad_nick: "nick: 3–20 letters, numbers or _",
    err_bad_password: "password must be at least 6 characters",
    err_need_login: "log in to like",
    err_fail: "could not reach the server",
    err_auth: "log in to like",
    err_no_db: "could not reach the server"
  },
  ua: {
    intro: "я — український модороб данделіон, зосереджений на атмосферних механіках, дрібних деталях і захопливому ґеймплеєві.",
    intro2: "я створюю моди, дата-паки та ресурс-паки для java-видання майнкрафту, здебільшого працюючи на таких модлоадерах, як fabric та neoforge, інколи forge. чи планую я розвиватися у бік bedrock-видання? поки не бачу на то причин, але все залежить від майбутньої спільноти та її потреб",
    versions_title: "Підтримувані версії:",
    col_datapacks: "пакети даних",
    col_resourcepacks: "пакети ресурсів",
    footer: "сайт створено Норімару, за ідеї Данделіону",
    account_enter: "увійти",
    account_nick: "нік",
    account_password: "пароль",
    account_login: "увійти",
    account_register: "створити профіль",
    account_logout: "вийти",
    account_close: "закрити",
    err_taken: "цей нік уже зайнятий",
    err_bad_login: "неправильний нік або пароль",
    err_bad_nick: "нік: 3–20 літер, цифр або _",
    err_bad_password: "пароль має бути щонайменше 6 символів",
    err_need_login: "щоб поставити вподобайку, увійди в профіль",
    err_fail: "не вдалося зв’язатися з сервером",
    err_auth: "щоб поставити вподобайку, увійди в профіль",
    err_no_db: "не вдалося зв’язатися з сервером"
  }
};

function getLang() {
  var saved = localStorage.getItem(LANG_KEY);
  if (saved === "ua" || saved === "en") return saved;
  return "en";
}

function setLang(lang) {
  var next = lang === "ua" ? "ua" : "en";
  localStorage.setItem(LANG_KEY, next);
  document.documentElement.lang = next === "ua" ? "uk" : "en";
  document.documentElement.dataset.lang = next;
  return next;
}

function t(key) {
  var pack = translations[getLang()] || translations.en;
  return pack[key] || translations.en[key] || key;
}

function applyI18n() {
  var lang = getLang();
  setLang(lang);

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    var active = btn.getAttribute("data-lang") === lang;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

document.addEventListener("DOMContentLoaded", function () {
  applyI18n();
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setLang(btn.getAttribute("data-lang"));
      applyI18n();
    });
  });
});
