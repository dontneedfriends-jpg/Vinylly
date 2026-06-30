# Сборка и запуск

## Веб-разработка

```bash
pnpm install
pnpm --filter @vinylly/web dev
```

Откроется на `http://localhost:5173`. Данные сохраняются в `localStorage` браузера.

## Сборка веб-бандла

```bash
pnpm --filter @vinylly/web build
```

Артефакт: `apps/web/dist/`.

## Десктоп (Tauri 2.x)

Системные зависимости (Linux): `webkit2gtk-4.1`, `librsvg2-dev`, `libssl-dev`,
`libayatana-appindicator3-dev`. На Windows — WebView2 (предустановлен на Windows 10+).

```bash
# Запуск в режиме разработки (web + tauri вместе)
pnpm --filter @vinylly/desktop dev

# Сборка portable-бинаря (без инсталляторов)
pnpm --filter @vinylly/desktop tauri build --no-bundle
# или debug-вариант
pnpm --filter @vinylly/desktop tauri build --no-bundle --debug

# Сборка с инсталляторами (.deb, .AppImage, .msi, .exe)
pnpm --filter @vinylly/desktop build
```

Артефакты:

- Бинарь: `apps/desktop/src-tauri/target/release/vinylly[.exe]`
- Инсталляторы (если включены): `apps/desktop/src-tauri/target/release/bundle/`

### Portable-режим

```bash
# Linux
./vinylly --portable

# или
VINYL_PORTABLE=1 ./vinylly

# Windows
vinylly.exe --portable
```

В portable-режиме все данные (БД, кеш обложек, кеш API) пишутся в `./data` рядом
с исполняемым файлом. Без флага — в системную директорию:

| OS      | Путь                                                 |
| ------- | ---------------------------------------------------- |
| Linux   | `~/.local/share/app.vinylly.desktop/`                |
| Windows | `%APPDATA%\app.vinylly.desktop\`                     |
| macOS   | `~/Library/Application Support/app.vinylly.desktop/` |

### Кросс-компиляция

Из Linux собрать `.msi`/`.exe` можно, но требует `mingw-w64` и не всегда
стабильно. Рекомендуется собирать нативно под каждую платформу (или
использовать CI-раннеры).

## Сидер (демо-данные)

```bash
cd packages/db
pnpm prisma:migrate
pnpm seed
```

## CI

```bash
pnpm lint        # ESLint + cargo fmt/clippy
pnpm typecheck   # tsc --noEmit для всех пакетов
pnpm test        # vitest run
pnpm format:check
```
