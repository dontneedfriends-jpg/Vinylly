# Color Tokens

> Палитра построена на **IBM Carbon Color System** (Gray, Blue, Red, Green, Yellow) с сохранением неоморфной подачи: единственный цвет поверхности, объём создаётся двусторонними тенями.

## Background Tokens

### Surface

| Token                | Light    | Dark     |
| -------------------- | -------- | -------- |
| neutral-primary-soft | `#F4F4F4` | `#161616` |

- Light: **Carbon Gray 10** — основной фон Carbon Light Theme.
- Dark: **Carbon Gray 100** — основной фон Carbon Dark Theme.

**CRITICAL RULE:** В чистом неоморфизме существует **только один** цвет фона для всего UI. Страница, карточки, кнопки, инпуты, боковые панели — **все** используют `neutral-primary-soft`. Не использовать разные цвета фона для дифференциации элементов. Глубина и разделение — **только** через тени (`shadow-sm`, `shadow-md`, `shadow-inset`).

## Text Color Tokens

### Иерархия текста

| Token           | Light     | Dark      | Carbon token   |
| --------------- | --------- | --------- | -------------- |
| `heading`       | `#161616` | `#F4F4F4` | Gray 100 / 10  |
| `body`          | `#393939` | `#C6C6C6` | Gray 80 / 30   |
| `body-subtle`   | `#6F6F6F` | `#8D8D8D` | Gray 60 / 50   |
| `fg-disabled`   | `#A8A8A8` | `#6F6F6F` | Gray 40 / 60   |

### Бренд (Carbon Blue)

| Token                | Light     | Dark      | Carbon token  |
| -------------------- | --------- | --------- | ------------- |
| `color-brand`        | `#0F62FE` | `#4589FF` | Blue 60 / 50  |
| `color-brand-strong` | `#0043CE` | `#A6C8FF` | Blue 70 / 40  |
| `color-secondary`    | `#0072C3` | `#78A9FF` | Blue 80 / 30  |

> В тёмной теме используются более светлые оттенки Blue (50/40) для сохранения рекомендованного Carbon-контраста на тёмном фоне.

### Семантические (Carbon Red / Green / Yellow)

| Token                | Light     | Dark      | Carbon token  |
| -------------------- | --------- | --------- | ------------- |
| `fg-danger`          | `#DA1E28` | `#FF8389` | Red 60 / 40   |
| `fg-danger-strong`   | `#BA1B22` | `#FA4D56` | Red 70 / 50   |
| `fg-success`         | `#198038` | `#42BE65` | Green 60 / 50 |
| `fg-success-strong`  | `#0E6027` | `#6FDC8C` | Green 70 / 60 |
| `fg-warning`         | `#B28600` | `#F1C21B` | Yellow 60 / 30 |

## Semantic Backgrounds (мягкие тонированные подложки)

Используются для бейджей, алертов, состояний — **никогда** как фон структурных элементов.

| Token            | Light                                  | Dark                                  |
| ---------------- | -------------------------------------- | ------------------------------------- |
| `brand-softer`   | `rgba(15, 98, 254, 0.06)`              | `rgba(69, 137, 255, 0.1)`             |
| `brand-soft`     | `rgba(15, 98, 254, 0.1)`               | `rgba(69, 137, 255, 0.18)`            |
| `danger-soft`    | `rgba(218, 30, 40, 0.06)`              | `rgba(255, 131, 137, 0.1)`            |
| `success-soft`   | `rgba(25, 128, 56, 0.06)`              | `rgba(66, 190, 101, 0.1)`             |
| `warning-soft`   | `rgba(178, 134, 0, 0.06)`              | `rgba(241, 194, 27, 0.1)`             |
| `secondary-soft` | `rgba(0, 114, 195, 0.06)`              | `rgba(120, 169, 255, 0.1)`            |

## Borders (полупрозрачные, Carbon-style)

Вместо пигментированных границ Carbon использует полупрозрачный чёрный/белый:

| Token                     | Light                            | Dark                                |
| ------------------------- | -------------------------------- | ----------------------------------- |
| `border-default`          | `rgba(0, 0, 0, 0.08)`            | `rgba(255, 255, 255, 0.08)`         |
| `border-default-medium`   | `rgba(0, 0, 0, 0.16)`            | `rgba(255, 255, 255, 0.16)`         |
| `border-default-strong`   | `rgba(0, 0, 0, 0.32)`            | `rgba(255, 255, 255, 0.32)`         |
| `border-brand`            | `rgba(15, 98, 254, 0.5)`         | `rgba(69, 137, 255, 0.5)`           |
| `border-brand-subtle`     | `rgba(15, 98, 254, 0.2)`         | `rgba(69, 137, 255, 0.3)`           |
| `border-danger-subtle`    | `rgba(218, 30, 40, 0.2)`         | `rgba(255, 131, 137, 0.3)`          |
| `border-success-subtle`   | `rgba(25, 128, 56, 0.2)`         | `rgba(66, 190, 101, 0.3)`           |

## Semantic Usage Rules

- **Backgrounds:** **Каждый** элемент (страница, сайдбар, карточка, кнопка, инпут, бейдж) использует `neutral-primary-soft`. Фоны **обязаны** оставаться в неоморфной подаче.
- **Text & Icons:** ссылки, иконки, заголовки и параграфы используют foreground-цвета (`color-brand`, `color-secondary`, `heading`, `body`) для передачи смысла и состояния.
- **Primary elements:** ссылки, primary-иконки и primary-кнопки — `neutral-primary-soft` фон + `shadow-sm` + `color-brand` цвет текста/иконки.
- **Secondary elements:** secondary-иконки, графики и secondary-кнопки — `color-secondary` цвет текста/иконки.
- **Active/Pressed states:** `neutral-primary-soft` фон + `shadow-inset`.
- **Headings:** `heading` цвет.
- **Body text:** `body` цвет.
- **Status:** передаётся через `color-brand` (положительный/primary) или `color-secondary` (отрицательный/secondary) цвет текста, иконки или заливки графика, **никогда** через цвет фона.

## Prohibited

- **NO** solid colored backgrounds для кнопок, бейджей или карточек.
- **NO** alternating background colors для секций.
- **NO** raw hex/rgb values в коде компонентов — все цвета через токены → CSS custom properties → Tailwind классы (`bg-surface`, `text-fg-heading`, `shadow-neu-md` и т.д.).
- **NO** отступление от IBM Carbon-палитры в произвольных hex — если нужен новый оттенок, добавляется отдельный токен в этом файле.
