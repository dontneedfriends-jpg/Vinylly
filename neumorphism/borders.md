# Borders

## Width Scale

| Context                          | Width |
| -------------------------------- | ----- |
| Default (inputs, buttons, cards) | 1px   |
| Emphasis / focus                 | 2px   |

## Color Tokens

Все границы — **полупрозрачные** (Carbon-style), а не пигментированные:

- **Light theme** — `rgba(0, 0, 0, ...)` (полупрозрачный чёрный на светлой поверхности)
- **Dark theme** — `rgba(255, 255, 255, ...)` (полупрозрачный белый на тёмной поверхности)
- **Brand / danger / success** — соответствующий тон с альфой 0.2 (subtle) или 0.5 (default)

Полная таблица токенов в [`colors.md`](colors.md) → раздел **Borders**.

## Rules

- **Solid** границы по умолчанию
- **Dashed** только для спецкейсов (file dropzones, decorative)
- Элементы одного семейства используют **одинаковую** толщину границ
- **Никогда** не смешивать 1px и 2px в одном компоненте
- **Никогда** не использовать пигментированные границы (типа `border-gray-300`) — только полупрозрачные через токены

## Usage

| Context                      | Width                                   | Token                       |
| ---------------------------- | --------------------------------------- | --------------------------- |
| Inputs / selects / textareas | 1px default; 2px on focus or error      | `border-default-medium`     |
| Buttons                      | 1px для outlined-вариантов             | `border-default`            |
| Cards / containers           | 1px subtle                              | `border-default`            |
| Active / focused state       | 1px brand, 1px ring `color-brand`       | `border-brand` + ring       |
| Error state                  | 1px danger                               | `border-danger-subtle`      |
