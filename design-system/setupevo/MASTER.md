# Design System Master File: Apple Mobile (iOS Style)

> **LOGIC:** When building a specific page, first check `design-system/setupevo/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** SetupEvo
**Generated:** 2026-04-26 15:08:40
**Category:** Apple/iOS Mobile Interface
**Style:** iOS 17+ / Glassmorphism / Minimalist

---

## Global Rules

### Color Palette (Semantic iOS)

| Role | Hex | CSS Variable | Light Mode | Dark Mode |
|------|-----|--------------|------------|-----------|
| **System Background** | `#F2F2F7` / `#000000` | `--bg-system` | Gray 6 (Light) | Black |
| **Secondary Background** | `#FFFFFF` / `#1C1C1E` | `--bg-secondary` | White | Gray 6 (Dark) |
| **Primary (Accent)** | `#007AFF` | `--color-primary` | Blue | Blue |
| **Success** | `#34C759` | `--color-success` | Green | Green |
| **Warning** | `#FF9500` | `--color-warning` | Orange | Orange |
| **Destructive** | `#FF3B30` | `--color-danger` | Red | Red |
| **Label (Text)** | `#000000` / `#FFFFFF` | `--color-text` | Black | White |
| **Secondary Label** | `#3C3C4399` / `#EBEBF599` | `--color-text-muted` | Muted Gray | Muted White |

### Typography

- **Primary Font:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, "Segoe UI", `Roboto`, `Helvetica`, `Arial`, `sans-serif`
- **Scale:**
  - **Large Title:** 34px (Bold)
  - **Title 1:** 28px (Semibold)
  - **Title 2:** 22px (Semibold)
  - **Headline:** 17px (Semibold)
  - **Body:** 17px (Regular)
  - **Footnote:** 13px (Regular)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

### Layout & Spacing

- **Corner Radius:** `12px` (Standard), `20px` (Cards), `9999px` (Pills)
- **Margins:** `16px` (Mobile), `32px` (Desktop)
- **Safe Areas:** Respect notch and home indicator spacing.

---

## Component Specs

### Cards (Glassmorphism)
```css
.ios-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  padding: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05);
}
.dark .ios-card {
  background: rgba(28, 28, 30, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Tab Bar (Bottom Nav)
- **Position:** Fixed bottom
- **Blur:** Heavy blur (`backdrop-blur-xl`)
- **Icons:** Lucide (System style)
- **Active State:** SystemBlue tint

### Sidebars (Desktop)
- **Width:** 280px
- **Style:** Semi-transparent with blur, background-integrated.

---

## Style Guidelines

1. **Prioritize Content over Chrome**: No heavy borders. Use whitespace and blur to separate sections.
2. **Smooth Transitions**: All state changes must be 200-300ms ease-out.
3. **SF Symbols Vibe**: Use `lucide-react` icons but keep them thin and clean.
4. **Touch Targets**: Minimum 44x44px for all buttons.

---

## Anti-Patterns (Do NOT Use)

- ❌ **Heavy Shadows** — Use subtle, large-radius shadows only.
- ❌ **Hard Borders** — Use material differences (blur/vibrancy) or 1px subtle lines.
- ❌ **Square Corners** — Everything must be rounded.
- ❌ **Mixed Icon Sets** — Stick to Lucide exclusively.
- ❌ **No Hover State** — All interactive elements must have a subtle hover opacity or color shift.
