<div align="center">

# Vinylly

**Каталогизатор физической аудио-коллекции, который выглядит как приложение, а не как таблица.**

[![Build](https://img.shields.io/badge/build-passing-0F62FE?logo=github)](./)
[![License: MIT](https://img.shields.io/badge/License-MIT-0F62FE)](./LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8D8?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)

</div>

---

## Что это

**Vinylly** — десктопное приложение для учёта физических аудио-носителей: винила, CD, кассет и всего остального, что стоит на ваших полках.

Оно не стримит музыку и не пытается заменить Discogs. Оно решает одну задачу — **быстро и красиво каталогизировать коллекцию**: добавить релиз, получить обложку и треклист, записать состояние носителя, место хранения и личные заметки.

## Почему Vinylly

| Боль коллекционера                           | Как решает Vinylly                                      |
| -------------------------------------------- | ------------------------------------------------------- |
| Обложки и метаданные разбросаны по сервисам  | Поиск по Discogs / MusicBrainz и автозаполнение полей   |
| Состояние пластинки помнишь «на глазок»      | Поля для оценки конверта и носителя + заметки           |
| Не помнишь, где что лежит                    | Поле «Где хранится» с быстрым поиском                   |
| Хочется offline-first                        | SQLite локально, сеть — только для обогащения           |
| Не хочется устанавливать «ещё один Electron» | Tauri 2.x: нативный бинарник, малый вес, portable-режим |

## Возможности

- **Добавление за секунды** — по штрих-коду, каталожному номеру или названию.
- **Автообогащение** — обложки, треклисты, год, жанр, лейбл из Discogs / MusicBrainz.
- **Сетка коллекции** — обложки плитками, фильтры по формату, поиск, сортировка.
- **Карточка релиза** — обложка, метаданные, «мои заметки», треклист с текстами песен.
- **Импорт / экспорт** — JSON и CSV для бэкапа и миграции.
- **Portable** — запуск с флешки без установки (`--portable` или `VINYL_PORTABLE=1`).
- **Neumorphism UI** — единая дизайн-система со светлой и тёмной темой.

<!-- TODO: заменить на реальные скриншоты -->
<!-- ![Collection](./docs/screenshots/collection.png) -->
<!-- ![Detail](./docs/screenshots/detail.png) -->

## Технологический стек

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** Tailwind CSS + собственная neumorphic дизайн-система
- **State:** TanStack Query + Zustand
- **Desktop:** Tauri 2.x (Rust + WebView)
- **Database:** SQLite через Prisma
- **Providers:** Discogs, MusicBrainz / Cover Art Archive, Last.fm, Genius
- **Tests:** Vitest + Playwright

## Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone https://github.com/username/vinylly.git
cd vinylly

# 2. Установить зависимости
pnpm install

# 3. Запустить в режиме разработки
pnpm dev
```

## Скрипты

```bash
pnpm lint          # ESLint по всем пакетам
pnpm typecheck     # TypeScript проверка типов
pnpm test          # Unit-тесты
pnpm format        # Prettier
pnpm dev           # Dev-сервер
pnpm build         # Полная сборка (web + desktop)
```

## Сборка desktop-приложения

Требования: Rust toolchain + зависимости Tauri ([гайд по установке](https://tauri.app/start/prerequisites/)).

```bash
# Сборка portable-бинарника
pnpm --filter @vinylly/desktop build --no-bundle

# Артефакт
# Windows: apps/desktop/src-tauri/target/release/vinylly.exe
# Linux:   apps/desktop/src-tauri/target/release/vinylly
```

## Архитектура

```
Vinylly/
├── apps/
│   ├── web/                # React + Vite (WebView payload)
│   └── desktop/            # Tauri 2.x оболочка
├── packages/
│   ├── db/                 # Prisma schema + SQLite
│   ├── media-providers/    # Discogs / MusicBrainz / Last.fm / Genius
│   ├── host/               # HostFs / HostPaths / HostNet абстракции
│   └── ui/                 # Neumorphic компоненты
├── package.json            # pnpm workspace
└── README.md
```

Ключевой принцип — **портируемость**: бизнес-логика и UI не зависят от платформы. Тот же TypeScript-код работает в десктопе, вебе и (в перспективе) на мобильных устройствах.

## Roadmap

- [x] База данных и модели
- [x] Поиск и импорт релизов
- [x] Коллекция и детальная карточка
- [x] Импорт / экспорт JSON и CSV
- [ ] Тексты песен с fallback
- [ ] Android / iOS порты
- [ ] PWA-сборка

## Лицензия

MIT © Vinylly Contributors
