<div align="center">
  <br>
  <h1>Vinylly</h1>
  <p><strong>Каталогизатор физической аудио-коллекции, который выглядит как приложение, а не как бухгалтерская ведомость.</strong></p>

  <p>
    <a href="https://github.com/dontneedfriends-jpg/Vinylly/actions"><img src="https://img.shields.io/github/actions/workflow/status/annenskei/Vinylly/ci.yml?branch=main&style=flat-square&logo=github&color=0F62FE" alt="CI"></a>
    <a href="./LICENSE.md"><img src="https://img.shields.io/badge/License-Non--Commercial-F56C2D?style=flat-square" alt="License"></a>
    <a href="https://tauri.app"><img src="https://img.shields.io/badge/Tauri-2.x-24C8D8?style=flat-square&logo=tauri" alt="Tauri"></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React"></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript"></a>
    <br>
    <a href="./README.en.md"><img src="https://img.shields.io/badge/Read%20in-English-0F62FE?style=flat-square" alt="English"></a>
    <a href="https://boosty.to/annenskei/donate"><img src="https://img.shields.io/badge/Sponsor-Boosty-F56C2D?style=flat-square&logo=boosty" alt="Sponsor"></a>
  </p>
</div>

<br>

---

> **Хотите по-английски?** [Переключиться на English](./README.en.md)

---

## Поддержать проект

Vinylly — бесплатный open-source проект. Я пишу его в свободное время, а свободного времени, как вы понимаете, с каждым годом всё меньше. Если вам не жалко — купите мне кофе. Или чай. Или подписку на Spotify (иронично, да?).

- **[Boosty](https://boosty.to/annenskei/donate)**
- **[DonationAlerts](https://dalink.to/annenskei)**
- **Bitcoin:** `bc1qvuhvewu3rjth80wnpdxkrl6vwtgjtspszkcqap`
- **Ethereum:** `0xc126080ffD216827A37850a5511cf1273E303E73`
- **Solana:** `516jeJxi1gwaRH7aEEiopAUAGNHKMrUxWv4cfGm32GhB`

---

## Что это

Вы когда-нибудь стояли посреди комнаты, смотрели на полку с пластинками и думали: «Я точно помню, что у меня есть этот альбом. Или нет? Или это у соседа было?» Я стоял. И не раз.

**Vinylly** — десктопное приложение для учёта физических аудио-носителей: винила, CD, кассет и всего остального, что пылится на ваших полках. Оно не стримит музыку и не пытается заменить Discogs. Оно просто помогает не покупать четвёртую копию *Abbey Road* — потому что вы забыли про третью.

---

## Почему Vinylly

| Боль коллекционера                           | Как решает Vinylly                                      |
| :------------------------------------------- | :------------------------------------------------------ |
| Обложки и метаданные разбросаны по сервисам  | Поиск по Discogs / MusicBrainz и автозаполнение полей   |
| Состояние пластинки помнишь «на глазок»      | Поля для оценки конверта и носителя + заметки           |
| Не помнишь, где что лежит                    | Поле «Где хранится» с быстрым поиском                   |
| Хочется offline-first                        | SQLite локально, сеть — только для обогащения           |
| Не хочется ставить «ещё один Electron»        | Tauri 2.x: нативный бинарник, малый вес, portable-режим |

---

## Возможности

- **Добавление за секунды** — по штрих-коду, каталожному номеру или названию.
- **Автообогащение** — обложки, треклисты, год, жанр, лейбл, рыночная цена, рейтинг, has/want-счётчики из Discogs / MusicBrainz / Last.fm.
- **Сетка коллекции** — обложки плитками, фильтры по формату, тегам, году, поиск, сортировка.
- **Карточка релиза** — обложка (зум + галерея), метаданные, рыночная статистика, прессования мастера с пометками owned/wanted, треклист с текстами песен, мои заметки.
- **Список желаемого (Wantlist)** — отдельная страница, импорт из Discogs, кнопка «Добавить в коллекцию» из карточки релиза, синхронизация с Discogs (`/users/{u}/wants`).
- **Карточка артиста** — профиль с Discogs, список owned + wanted, прогресс коллекционирования (NN% от каталога артиста).
- **Статистика** — карточки: тип носителя, финансы (потрачено, рыночная стоимость, прибыль), топ-5 самых ценных, скрытые жемчужины, юбилеи, активность по месяцам, теги, ДНК коллекции, рейтинг ROI, нет данных.
- **Импорт / экспорт** — JSON-снапшот всей БД + бандл `vinylly.v2` для переноса коллекции. CSV-экспорт для таблиц.
- **Portable** — запуск с флешки без установки (`--portable` или `VINYL_PORTABLE=1`).
- **Горячие клавиши** — `1`–`5` для навигации между разделами, `/` для поиска, `?` для справки, `Esc` для закрытия тостов.
- **Neumorphism UI** — единая дизайн-система со светлой, тёмной и автоматической (`prefers-color-scheme`) темой.

<!-- TODO: screenshots -->
<!-- ![Collection](./docs/screenshots/collection.png) -->
<!-- ![Detail](./docs/screenshots/detail.png) -->

---

## Технологический стек

| Слой              | Технологии                                                             |
| :---------------- | :--------------------------------------------------------------------- |
| Frontend          | React 18, TypeScript, Vite                                             |
| UI / Styling      | Tailwind CSS, собственная neumorphic дизайн-система                    |
| State Management  | TanStack Query, Zustand                                                |
| Desktop           | Tauri 2.x (Rust + WebView)                                             |
| Database          | SQLite, Prisma                                                         |
| Media Providers   | Discogs (search, release, master, artist, wantlist, marketplace), MusicBrainz + Cover Art Archive, Last.fm (related artists, similar), Genius, Lrclib |
| i18n              | i18next (русский + английский)                                         |
| Testing           | Vitest (82 unit-тестов), Playwright (планируется)                      |

---

## Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone https://github.com/annenskei/vinylly.git
cd vinylly

# 2. Установить зависимости
pnpm install

# 3. Запустить dev-сервер
pnpm dev
```

### Доступные скрипты

```bash
pnpm lint          # ESLint — чтобы код не выглядел как мои первые скрипты на PHP
pnpm typecheck     # TypeScript: проверка типов
pnpm test          # Unit-тесты (да, я их пишу, представьте себе)
pnpm format        # Prettier — всё должно быть красиво, даже код
pnpm dev           # Dev-сервер (Vite)
pnpm build         # Полная сборка (web + desktop)
```

---

## Сборка desktop-приложения

Требуется Rust toolchain + зависимости Tauri ([инструкция](https://tauri.app/start/prerequisites/)). Если вы никогда не ставили Rust... ничего страшного, один раз настроить — и дальше всё само.

```bash
pnpm --filter @vinylly/desktop build --no-bundle
```

Артефакт появится в:
- **Windows:** `apps/desktop/src-tauri/target/release/vinylly.exe`
- **Linux:** `apps/desktop/src-tauri/target/release/vinylly`

---

## Архитектура

```
Vinylly/
├── apps/
│   ├── web/                # React + Vite (WebView payload)
│   └── desktop/            # Tauri 2.x (Rust оболочка)
├── packages/
│   ├── db/                 # Prisma schema + SQLite
│   ├── media-providers/    # Клиенты Discogs, MusicBrainz, Last.fm, Genius
│   ├── host/               # HostFs / HostPaths / HostNet абстракции
│   └── ui/                 # Neumorphic компоненты
├── package.json            # pnpm workspace
└── README.md
```

Ключевой принцип — **портируемость**: бизнес-логика и UI не зависят от платформы. Тот же TypeScript-код работает в десктопе, вебе и (когда дойдут руки) на мобильных устройствах.

---

## Roadmap

- [x] Этап 0 — скаффолд монорепо, линтинг, типы
- [x] Этап 1 — Prisma-схема, миграции, репозитории
- [x] Этап 2 — Discogs / MusicBrainz / Last.fm / Genius / Lrclib
- [x] Этап 3 — Tauri-команды, кеш обложек через HostFs
- [x] Этап 4 — UI коллекции, детальные карточки, формы
- [x] Wantlist (отдельная страница + Discogs-sync)
- [x] Pressings / Master-варианты на странице деталей
- [x] Статистика: финансы, ROI, топ-теги, юбилеи, ДНК коллекции, активность, скрытые жемчужины
- [x] Artist page с completion % от каталога Discogs
- [x] Release preview: добавление из Wantlist без отдельного AddPage
- [x] Hot keys (1–5 навигация, `/` поиск, `?` помощь)
- [x] Полная тестовая база (82 unit-теста), green lint/typecheck
- [ ] Этап 5 — расширенный lyrics-провайдер (синхронизированные LRC)
- [ ] Этап 6 — полировка (анимации, скелетоны, e2e)
- [ ] Этап 7 — Android / iOS / PWA порты

---

## Лицензия

[Vinylly Non-Commercial License](./LICENSE.md) — бесплатно для некоммерческого использования.  
Для коммерческого использования требуется письменное разрешение. Подробности в [LICENSE.md](./LICENSE.md).

---

<div align="center">
  <sub>Сделано с любовью и небольшим количеством свободного времени</sub>
  <br>
  <sub><a href="./README.en.md">English version</a></sub>
</div>
