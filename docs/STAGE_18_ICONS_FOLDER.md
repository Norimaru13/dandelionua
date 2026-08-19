# Етап 18. Усі іконки в `assets/icons/`

Дата: 19.08.2026

---

## 1. Що змінено

- Усі PNG (кнопки, хедер, лого, мова, старі текстури) перенесені в `assets/icons/`.
- У меню Discord тепер `assets/icons/discord_link.png`, а не старий SVG.
- Шляхи в `index.html` оновлені під нову папку.

---

## 2. Як саме

Кожна картинка на сторінці береться з `assets/icons/...`. Favicon теж.

`_build_embed.py` читає PNG з тієї ж папки, якщо знову збирати hex.

`.side-slot img` має `image-rendering: pixelated`, щоб піксельний Discord не милився.

---

## 3. Що варто знати

1. Нові текстури класти в `assets/icons/`.
2. Посилання Discord ще немає — тільки картинка.
3. Старі SVG (Discord / Telegram / Modrinth / Reddit / MCreator / CurseForge) лишились у тій самій папці. На сайті з них ідуть усі, крім Discord.

---

## 4. Обмеження

Discord без URL, поки я його не дам.
