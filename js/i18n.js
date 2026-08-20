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
    footer: "© The site was created by Norimaru, based on Dandelion's idea",
    account_enter: "log in",
    account_nick: "nick",
    account_password: "password",
    account_login: "log in",
    account_register: "create profile",
    account_logout: "log out",
    account_close: "close",
    err_taken: "this nick is already taken",
    err_bad_login: "wrong nick or password",
    err_bad_nick: "nick: 3–20 letters, numbers, _ - .",
    err_need_sql: "database functions are missing — run docs/accounts.sql",
    err_bad_password: "password must be at least 6 characters",
    err_need_login: "log in to like",
    err_fail: "could not reach the server",
    err_auth: "log in to like",
    err_no_db: "could not reach the server",
    post_create: "Create publication",
    post_title: "title",
    post_title_en: "title (EN)",
    post_title_ua: "title (UK)",
    post_lead: "short description",
    post_body_en: "description (EN)",
    post_body_ua: "description (UK)",
    post_photos: "photos (up to 4)",
    post_publish: "publish",
    post_bold: "bold",
    post_italic: "italic",
    post_underline: "underline",
    post_strike: "strikethrough",
    post_link: "link",
    post_attach: "insert photo",
    post_close_confirm: "Close without saving?",
    confirm_yes: "yes",
    confirm_no: "no",
    err_empty_post: "enter a title",
    err_forbidden: "only the admin can publish",
    err_photo_big: "photo is too large (max ~500 KB)",
    err_photo_type: "photo: jpg, png, webp or gif",
    err_photo_many: "up to 4 photos",
    post_more: "more",
    post_edit: "edit",
    post_delete: "delete",
    post_delete_confirm: "Delete this publication?",
    post_photos_keep: "when editing, leave empty to keep current photos",
    nav_home: "Home",
    nav_projects: "Projects",
    nav_publications: "Posts",
    feed_more: "see more",
    post_kind: "type",
    post_kind_post: "Posts",
    social_modrinth: "Modrinth",
    social_curseforge: "CurseForge",
    social_mcreator: "MCreator",
    social_telegram: "Telegram",
    social_discord: "Discord",
    social_reddit: "Reddit",
    proj_types: "project type",
    proj_type_mod: "mod",
    proj_type_datapack: "data pack",
    proj_type_resourcepack: "resource pack",
    proj_state: "project state",
    proj_state_release: "release",
    proj_state_open_beta: "open beta",
    proj_state_closed_beta: "closed beta",
    proj_status: "project status",
    proj_status_ready: "ready",
    proj_status_wip: "in development",
    proj_status_paused: "development paused",
    proj_status_planned: "planned",
    proj_versions: "versions",
    proj_platforms: "platforms",
    proj_preview: "preview photo"
  },
  ua: {
    intro: "я — український модороб данделіон, зосереджений на атмосферних механіках, дрібних деталях і захопливому ґеймплеєві.",
    intro2: "я створюю моди, дата-паки та ресурс-паки для java-видання майнкрафту, здебільшого працюючи на таких модлоадерах, як fabric та neoforge, інколи forge. чи планую я розвиватися у бік bedrock-видання? поки не бачу на то причин, але все залежить від майбутньої спільноти та її потреб",
    versions_title: "Підтримувані версії:",
    col_datapacks: "пакети даних",
    col_resourcepacks: "пакети ресурсів",
    footer: "© Сайт було створено Норімару за ідеєю Данделіона",
    account_enter: "увійти",
    account_nick: "нік",
    account_password: "пароль",
    account_login: "увійти",
    account_register: "створити профіль",
    account_logout: "вийти",
    account_close: "закрити",
    err_taken: "цей нік уже зайнятий",
    err_bad_login: "неправильний нік або пароль",
    err_bad_nick: "нік: 3–20 літер, цифр, _ - .",
    err_need_sql: "немає функцій у базі — виконай docs/accounts.sql ще раз",
    err_bad_password: "пароль має бути щонайменше 6 символів",
    err_need_login: "щоб поставити вподобайку, увійди в профіль",
    err_fail: "не вдалося зв’язатися з сервером",
    err_auth: "щоб поставити вподобайку, увійди в профіль",
    err_no_db: "не вдалося зв’язатися з сервером",
    post_create: "Створити публікацію",
    post_title: "назва",
    post_title_en: "назва (EN)",
    post_title_ua: "назва (UK)",
    post_lead: "короткий опис",
    post_body_en: "опис (EN)",
    post_body_ua: "опис (UK)",
    post_photos: "фото (до 4)",
    post_publish: "опублікувати",
    post_bold: "напівжирний",
    post_italic: "курсив",
    post_underline: "підкреслення",
    post_strike: "закреслений",
    post_link: "посилання",
    post_attach: "вставити фото",
    post_close_confirm: "Закрити без збереження?",
    confirm_yes: "так",
    confirm_no: "ні",
    err_empty_post: "введи назву",
    err_forbidden: "публікувати може лише адміністратор",
    err_photo_big: "фото завелике (макс. близько 500 КБ)",
    err_photo_type: "фото: jpg, png, webp або gif",
    err_photo_many: "не більше 4 фото",
    post_more: "ще",
    post_edit: "редагувати",
    post_delete: "видалити",
    post_delete_confirm: "Видалити цю публікацію?",
    post_photos_keep: "при редагуванні залиш порожнім, щоб зберегти поточні фото",
    nav_home: "Головна",
    nav_projects: "Проєкти",
    nav_publications: "Пости",
    feed_more: "дивитись більше",
    post_kind: "тип",
    post_kind_post: "Пости",
    social_modrinth: "Модрінт",
    social_curseforge: "CurseForge",
    social_mcreator: "MCreator",
    social_telegram: "Телеграм",
    social_discord: "Діскорд",
    social_reddit: "Реддіт",
    proj_types: "тип проєкту",
    proj_type_mod: "мод",
    proj_type_datapack: "пакет даних",
    proj_type_resourcepack: "пакет ресурсів",
    proj_state: "стан проєкту",
    proj_state_release: "реліз",
    proj_state_open_beta: "відкритий бета-тест",
    proj_state_closed_beta: "закритий бета-тест",
    proj_status: "статус проєкту",
    proj_status_ready: "готовий",
    proj_status_wip: "в розробці",
    proj_status_paused: "розробку призупинено",
    proj_status_planned: "запланований",
    proj_versions: "версії",
    proj_platforms: "платформи",
    proj_preview: "прев'ю"
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

  document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
    var label = t(el.getAttribute("data-i18n-title"));
    el.setAttribute("title", label);
    el.setAttribute("aria-label", label);
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
