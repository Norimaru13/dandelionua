# Етап 13. GitHub Pages

Дата: 19.08.2026

---

## 1. Що змінено

- Створено публічний репозиторій https://github.com/Norimaru13/dandelionua
- Код сайту залитий (HTML, CSS, JS, SVG, workflow)
- PNG через API не проходять як картинки — їх треба дослати одним `git push` з цього комп’ютера
- Додано `.nojekyll` і `.github/workflows/pages.yml`
- Встановлено Git
- Actions падає з `Resource not accessible by integration`: токен не може **створити** Pages. Треба один раз увімкнути Pages у Settings.

---

## 2. Як це зроблено

Акаунт GitHub: **Norimaru13**.

Адреса сайту після деплою:

https://norimaru13.github.io/dandelionua/

Actions зараз падає, бо Pages ще не ввімкнений. Один раз відкрий:

https://github.com/Norimaru13/dandelionua/settings/pages

1. **Source** → **GitHub Actions**
2. Збережи
3. Actions → останній червоний запуск → **Re-run jobs**

Після цього сайт має відкритися. Картинок ще не буде, поки не зробиш `git push` з PNG.

Локальний коміт уже є. Щоб дослати картинки, у PowerShell:

```
cd $env:USERPROFILE\Desktop\dandelionua
& "C:\Program Files\Git\cmd\git.exe" push -u origin main
```

GitHub попросить увійти. Після пушу Actions збере сайт.

На GitHub Pages немає `server.py`, тому лічильники там будуть тільки в браузері відвідувача (localStorage), не спільні для всіх.

---

## 3. Що варто знати перед наступними змінами

1. Після першого успішного `git push` наступні оновлення — знову `git add`, `git commit`, `git push`.
2. Спільні лайки/перегляди на Pages самі не запрацюють — потрібен окремий хостинг API.

---

## 4. Обмеження

- Без `git push` від мене PNG на Pages ще немає.
- Лічильники на Pages не глобальні.
