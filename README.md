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
- **Автообогащение** — обложки, треклисты, год, жанр, лейбл из Discogs / MusicBrainz.
- **Сетка коллекции** — обложки плитками, фильтры по формату, поиск, сортировка.
- **Карточка релиза** — обложка, метаданные, «мои заметки», треклист с текстами песен.
- **Импорт / экспорт** — JSON и CSV для бэкапа (чтобы было что восстанавливать, если что).
- **Portable** — запуск с флешки без установки (`--portable` или `VINYL_PORTABLE=1`).
- **Neumorphism UI** — единая дизайн-система со светлой и тёмной темой.

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
| Media Providers   | Discogs, MusicBrainz, Cover Art Archive, Last.fm, Genius               |
| Testing           | Vitest, Playwright                                                     |

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

- [x] База данных и модели
- [x] Поиск и импорт релизов
- [x] Коллекция и детальная карточка
- [x] Импорт / экспорт JSON и CSV
- [ ] Тексты песен с fallback
- [ ] Android / iOS порты (я знаю, вы ждёте)
- [ ] PWA-сборка

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
