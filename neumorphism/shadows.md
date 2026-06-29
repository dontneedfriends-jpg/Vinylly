# Shadows

| Token        | CSS value                                                |
| ------------ | -------------------------------------------------------- |
| shadow-2xs   | `1px 1px 2px #b8b9be, -1px -1px 2px #ffffff`             |
| shadow-xs    | `2px 2px 4px #b8b9be, -2px -2px 4px #ffffff`             |
| shadow-sm    | `3px 3px 6px #b8b9be, -3px -3px 6px #ffffff`             |
| shadow-md    | `6px 6px 12px #b8b9be, -6px -6px 12px #ffffff`           |
| shadow-lg    | `8px 8px 16px #b8b9be, -8px -8px 16px #ffffff`           |
| shadow-xl    | `10px 10px 20px #b8b9be, -10px -10px 20px #ffffff`       |
| shadow-2xl   | `12px 12px 24px #b8b9be, -12px -12px 24px #ffffff`       |
| shadow-inset | `inset 2px 2px 5px #b8b9be, inset -3px -3px 7px #ffffff` |

## Component Mapping

| Component type                                | Token                   |
| --------------------------------------------- | ----------------------- |
| Subtle separators, tiny UI details            | shadow-2xs or shadow-xs |
| Inputs, form controls, pressed elements       | shadow-inset            |
| Buttons, small controls, lightweight cards    | shadow-sm or shadow-md  |
| Standard cards, popovers, dropdowns           | shadow-md               |
| Prominent cards, sticky surfaces              | shadow-lg               |
| Modals, high-priority overlays                | shadow-xl               |
| Hero overlays, top-level emphasis (sparingly) | shadow-2xl              |

## Rules

- Use only these tokens — no custom box-shadow values
- Neumorphic depth comes from dual-directional shadows: a dark shadow on the bottom-right and a light shadow on the top-left
- Use shadow-inset for elements that should appear pressed into the surface (inputs, active states)
- Use raised shadow tokens (shadow-sm through shadow-2xl) for elements that should appear elevated from the surface
- Keep elevation steps intentional; avoid jumping multiple levels
- Components in the same family share the same baseline elevation
- Hover/focus on interactive elevated elements: step up by one level
- Never stack multiple shadow tokens on one element
- Never use shadow-xl/shadow-2xl for dense list items or body containers
- In dark mode, shadow colors must be adjusted to match the dark surface (#262833): use darker/lighter variants of the surface color instead of #b8b9be/#ffffff
