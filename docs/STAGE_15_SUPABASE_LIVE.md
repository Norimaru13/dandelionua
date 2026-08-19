# Етап 15. Ключі Supabase і живі текстури

Дата: 19.08.2026

---

## 1. Що змінено

- У `js/config.js` стоїть **Project URL** і **publishable** ключ. Секретний ключ на сайт не клав.
- Лічильники на `post.html` ходять у Supabase (`record_view`, `toggle_like`). Якщо виклик не вийде — лишається запасний варіант через localStorage.
- Справжні PNG уже в репозиторії і на GitHub Pages (кнопка, хедер, лого, мова).

---

## 2. Як саме

- З посилання прибрав `/rest/v1/`. У клієнті потрібен корінь проєкту: `https://bohgupycmdvosondvbyl.supabase.co`.
- На сайт пішов лише `sb_publishable_...`. `sb_secret_...` у файлах немає і не має з’являтися.
- SQL з `docs/supabase.sql` уже виконаний: таблиці `page_stats` / `page_visitors` і RPC відповідають.

---

## 3. Де що лежить

- `js/config.js` — URL і publishable ключ
- `js/stats.js` — виклики RPC і запасний localStorage
- `docs/supabase.sql` — таблиці, RLS, функції
- Живий сайт: https://norimaru13.github.io/dandelionua/
- Сторінка лічильників: https://norimaru13.github.io/dandelionua/post.html

---

## 4. Що варто знати

1. Секретний ключ, який я скинув у чат, треба **видалити** в Supabase: Project Settings → API Keys → створити новий secret, старий видалити. Сайт від цього не зламається: він секрет не використовує.
2. Publishable ключ на статичному сайті — нормально, бо доступ іде тільки через RLS і RPC.
3. Один перегляд і один лайк на людину рахуються по `localStorage` id відвідувача.
4. Текстури на Pages: якщо браузер показує стару версію — Ctrl+F5.

---

## 5. Обмеження

- Іконки Discord / Telegram / Modrinth / Reddit досі без посилань.
- GitHub Pages не запускає `server.py`. Спільні цифри йдуть лише через Supabase.
- Секретний ключ після витоку в чат треба замінити, навіть якщо він ніде в репозиторії не лежить.
