# Brand

## Identity

- **Design system name:** Neumorphism on IBM Carbon
- **Project name:** Vinylly
- **Бренд-цвет:** **IBM Carbon Blue** (`#0F62FE` light / `#4589FF` dark) — единый акцент для primary-действий, ссылок, активных состояний.
- **Палитра:** полная Carbon-палитра (Gray 10/100 для фона, Gray 100/10 для заголовков, Blue 60/50 для бренда, Red/Green/Yellow — для семантики). Детали в [`colors.md`](colors.md).

## Logo Usage

- Treat the project logo as the primary brand mark for this project.
- Use the logo in product headers, empty states, authentication screens, and branded dashboard surfaces when a brand cue is useful.
- Keep clear space around the logo; do not crop, distort, recolor, or place it on low-contrast surfaces.
- If no logo is set, use a simple text mark based on the project name rather than inventing an unrelated symbol.

## Rules

- Pair logo usage with accessible text labels where the brand mark alone would be ambiguous.
- Use `colors.md`, `components/typography.md`, `components/layout.md`, and component modules for all visual values outside of logo usage.
- **Бренд-цвет никогда не используется как фон структурного элемента** — только для текста, иконок, тонких границ и soft-подложек (`brand-softer`, `brand-soft`). Это правило сохраняется из неоморфной подачи.
- В **тёмной теме** бренд светлее (Blue 50) для сохранения рекомендованного Carbon-контраста на тёмном фоне. В **светлой** — Blue 60.
