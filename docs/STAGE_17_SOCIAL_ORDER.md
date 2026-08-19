# Етап 17. Порядок іконок і посилання Modrinth

Дата: 19.08.2026

---

## 1. Що змінено

- Порядок у меню кульбаби, зліва направо: Modrinth, CurseForge, MCreator, Telegram, Discord, Reddit.
- Modrinth має посилання: https://modrinth.com/user/dandelion_ua

---

## 2. Як саме

У `index.html` іконки переставлені. Modrinth — це `<a class="side-slot">` з `target="_blank"` і `rel="noopener noreferrer"`. Решта лишились кнопками без href.

У `.side-slot` додано `display: block` і `text-decoration: none`, щоб якір виглядав так само, як кнопка.

---

## 3. Що варто знати

Посилання на CurseForge, MCreator, Telegram, Discord і Reddit ставити тільки коли я їх дам. Тоді замінити відповідну кнопку на такий самий `<a class="side-slot">`.

---

## 4. Обмеження

П’ять іконок досі без адрес.
