## Shelly UI Style Guide (Mobile-first)

### Spacing
- Base unit: 8px
- Common gaps: 8px, 12px, 16px, 24px
- Avoid “magic numbers” unless necessary for alignment

### Touch Targets (WCAG-friendly)
- Minimum interactive target: 44×44px
- Buttons, badges, icon actions, and row actions should meet the minimum target on mobile

### Typography & Wrapping
- Section headers must wrap on small screens; never squeeze the title block to 1–2 characters wide
- Prefer wrapping by words; avoid character-by-character wrapping caused by overly constrained flex layouts

### Layout
- Use flex/grid with `min-width: 0` on text containers inside flex rows
- On mobile, stack action rows vertically when there isn’t enough horizontal space

### Holdings
- Holding names should be tappable and open the instrument detail/performance view
- Keep actions (Save/Remove) right-aligned but always large enough for touch
