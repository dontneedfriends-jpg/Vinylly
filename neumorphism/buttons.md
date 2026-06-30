# Buttons

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Core Specs (Pure Neumorphism)

- **Background:** `neutral-primary-soft` (Must match the parent surface exactly)
- **Radius:** 8px (base) or 9999px for pills
- **Border:** 1px solid `border-default` or transparent
- **Default State:** `shadow-sm` (Raised)
- **Hover State:** `shadow-md` (Elevated further) or text color change
- **Active/Pressed State:** `shadow-inset` (Pressed into the surface)
- **Font weight:** 500 (medium)
- **Transition:** all 200ms ease-in-out

## Variants

Since all buttons share the same background (`neutral-primary-soft`) and shadow behavior, variants are distinguished ONLY by their text color.

### Brand (Primary)

- **Text:** `fg-brand`
- **Default:** `shadow-sm`
- **Active:** `shadow-inset`

### Secondary / Neutral

- **Text:** `heading` or `body` color
- **Default:** `shadow-sm`
- **Active:** `shadow-inset`

### Success

- **Text:** `fg-success`
- **Default:** `shadow-sm`
- **Active:** `shadow-inset`

### Danger

- **Text:** `fg-danger`
- **Default:** `shadow-sm`
- **Active:** `shadow-inset`

### Ghost / Flat

- **Text:** `body` color
- **Default:** No shadow
- **Hover:** `shadow-sm`
- **Active:** `shadow-inset`

## Icons in Buttons

- Icon size: 16x16px
- Spacing:
  - **sm**: 8px gap between icon and label
  - **md**: 10px gap between icon and label
  - **lg**: 12px gap between icon and label
- Icon color matches text color
- Horizontal padding (отступ от текста/иконки до края кнопки):
  - **sm**: 14px
  - **md**: 20px
  - **lg**: 28px
