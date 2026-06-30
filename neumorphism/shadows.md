# Shadows

> Тени пересобраны под **IBM Carbon** поверхности:
> - Light: `#F4F4F4` (Gray 10) → свет `#FFFFFF`, тень `#C6C6C6` (Gray 30).
> - Dark: `#161616` (Gray 100) → свет `#262626` (Gray 90), тень `#000000`.

Неоморфный объём строится **двусторонними тенями**: тёмная снизу-справа, светлая сверху-слева.

## Токены

### Light theme (`#F4F4F4`)

| Token        | CSS value                                                 |
| ------------ | --------------------------------------------------------- |
| `shadow-2xs` | `1px 1px 2px #C6C6C6, -1px -1px 2px #FFFFFF`              |
| `shadow-xs`  | `2px 2px 4px #C6C6C6, -2px -2px 4px #FFFFFF`              |
| `shadow-sm`  | `3px 3px 6px #C6C6C6, -3px -3px 6px #FFFFFF`              |
| `shadow-md`  | `6px 6px 12px #C6C6C6, -6px -6px 12px #FFFFFF`            |
| `shadow-lg`  | `8px 8px 16px #C6C6C6, -8px -8px 16px #FFFFFF`            |
| `shadow-xl`  | `10px 10px 20px #C6C6C6, -10px -10px 20px #FFFFFF`        |
| `shadow-2xl` | `12px 12px 24px #C6C6C6, -12px -12px 24px #FFFFFF`        |
| `shadow-inset` | `inset 2px 2px 5px #C6C6C6, inset -3px -3px 7px #FFFFFF` |

### Dark theme (`#161616`)

| Token        | CSS value                                                |
| ------------ | -------------------------------------------------------- |
| `shadow-2xs` | `1px 1px 2px #000000, -1px -1px 2px #262626`             |
| `shadow-xs`  | `2px 2px 4px #000000, -2px -2px 4px #262626`             |
| `shadow-sm`  | `3px 3px 6px #000000, -3px -3px 6px #262626`             |
| `shadow-md`  | `6px 6px 12px #000000, -6px -6px 12px #262626`           |
| `shadow-lg`  | `8px 8px 16px #000000, -8px -8px 16px #262626`           |
| `shadow-xl`  | `10px 10px 20px #000000, -10px -10px 20px #262626`       |
| `shadow-2xl` | `12px 12px 24px #000000, -12px -12px 24px #262626`       |
| `shadow-inset` | `inset 2px 2px 5px #000000, inset -3px -3px 7px #262626` |

## Component Mapping

| Component type                                | Token                   |
| --------------------------------------------- | ----------------------- |
| Subtle separators, tiny UI details            | `shadow-2xs` or `shadow-xs` |
| Inputs, form controls, pressed elements       | `shadow-inset`          |
| Buttons, small controls, lightweight cards    | `shadow-sm` or `shadow-md` |
| Standard cards, popovers, dropdowns           | `shadow-md`             |
| Prominent cards, sticky surfaces              | `shadow-lg`             |
| Modals, high-priority overlays                | `shadow-xl`             |
| Hero overlays, top-level emphasis (sparingly) | `shadow-2xl`            |

## Rules

- **Использовать только эти токены** — никаких кастомных `box-shadow` значений.
- **Неоморфный объём** создаётся двусторонними тенями: тёмная снизу-справа, светлая сверху-слева.
- **`shadow-inset`** — для элементов, которые выглядят «вдавленными» в поверхность (инпуты, active-состояния).
- **Raised-токены** (`shadow-sm`…`shadow-2xl`) — для элементов, приподнятых над поверхностью.
- Шаги elevation **намеренные**; не прыгать через несколько уровней сразу.
- Элементы одного семейства имеют общий базовый elevation.
- **Hover/focus** на интерактивных raised-элементах: поднять на один уровень (`shadow-sm` → `shadow-md`).
- **Active/pressed** — `shadow-inset`.
- **Никогда** не стекать несколько shadow-токенов на одном элементе.
- **Никогда** не использовать `shadow-xl`/`shadow-2xl` для плотных списков или body-контейнеров.
- В тёмной теме тени **обязаны** быть пересобраны под тёмную поверхность (`#161616`): тень в `#000000`, свет в `#262626` (Carbon Gray 90). Значения из светлой темы использовать нельзя.
