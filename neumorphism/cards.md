# Cards

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `typography.md`

## Core Specs (Pure Neumorphism)

- **Background:** `neutral-primary-soft` (Must match the page background exactly)
- **Border:** 1px, `border-default` (Subtle edge definition)
- **Radius:** 8px (base)
- **Shadow:** `shadow-md` (Raised surface)

## States

### Static Card (no interactivity)

- Background: `neutral-primary-soft`
- Shadow: `shadow-md`
- No hover styles.

### Interactive Card (clickable)

- Background: `neutral-primary-soft`
- Default Shadow: `shadow-sm`
- Hover Shadow: `shadow-md`
- Active/Pressed Shadow: `shadow-inset`

## Rules

- NEVER use a different background color for a card. The neumorphic effect relies on the card being the exact same color as the canvas it sits on, with shadows creating the physical shape.
