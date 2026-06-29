# Sidebars

> Dependencies: `colors.md`, `radius.md`, `typography.md`, `shadows.md`

## Core Specs (Pure Neumorphism)

- **Background:** `neutral-primary-soft` (Exact same as the main page)
- **Right border:** 1px, `border-default` (Optional, shadows can also define the edge)
- **Width:** 256px

## Anatomy

### Navigation Item

- **Background:** `neutral-primary-soft`
- **Layout:** flex, vertically centered
- **Padding:** 8px horizontal, 8px vertical
- **Radius:** 8px (base)
- **Default State:** Flat (no shadow), `body` text color
- **Hover State:** `shadow-sm` (Raised), `heading` text color
- **Active State:** `shadow-inset` (Pressed), `fg-brand` text color

### Bottom CTA / Card

- **Background:** `neutral-primary-soft`
- **Padding:** 16px
- **Top margin:** 24px
- **Radius:** 8px (base)
- **Shadow:** `shadow-sm`

## Rules

- NO distinct background colors for the sidebar or its items.
- Active items look "pressed in" using `shadow-inset`.
- Hovered items look "raised" using `shadow-sm`.
