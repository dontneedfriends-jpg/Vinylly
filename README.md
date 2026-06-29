# Vinylly

Каталогизатор физической аудио-коллекции: винил, CD, кассеты, другие носители.

## Возможности (MVP)

- Добавление релизов по штрих-коду, каталожному номеру или названию
- Автоподгрузка обложек, треклистов и метаданных (Discogs, MusicBrainz, Last.fm)
- Сетка коллекции с обложками, фильтры и сортировка
- Тексты песен (Genius / ручной ввод)
- Десктоп-сборка под Linux/Windows как portable-артефакт
- Архитектура готова к портированию на Android/iOS и в веб (та же кодовая база)

## Архитектура

- **`apps/web`** — React + Vite SPA (WebView payload)
- **`apps/desktop`** — Tauri 2.x оболочка для Linux/Windows
- **`packages/db`** — Prisma схема, миграции, клиент (SQLite)
- **`packages/media-providers`** — клиенты Discogs/MusicBrainz/Last.fm/Genius
- **`packages/host`** — `HostFs` / `HostPaths` / `HostNet` — платформенные абстракции
- **`packages/ui`** — переиспользуемые neumorphic-компоненты
- **`neumorphism/`** — дизайн-система (контракт для UI)

## Требования

- Node.js ≥ 20
- pnpm ≥ 9
- (для desktop-сборки) Rust toolchain + системные зависимости Tauri

## Установка

```bash
pnpm install
```

## Скрипты

```bash
pnpm lint          # линтинг всех пакетов
pnpm typecheck     # проверка типов
pnpm test          # тесты
pnpm dev           # запуск в режиме разработки
pnpm build         # сборка всех пакетов
pnpm format        # форматирование (prettier)
```

## Дизайн-система

Весь UI следует дизайн-системе Neumorphism, описанной в `./neumorphism/`. Перед
написанием UI-кода обязательно прочитайте релевантные модули (`SKILL.md`,
`colors.md`, `shadows.md` и т.д.).

Подробности — в [`AGENTS.md`](./AGENTS.md).
