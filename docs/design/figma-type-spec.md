# ArthaMind type styles (Figma spec)

Families: **Manrope** (headings, display) · **Inter** (body, UI, every figure) · **Noto Sans** and **Mukta** (Indian-script fallback, per locale only).
Weights loaded: Manrope 500/600/700; Inter 400/500/600. Desktop values first; mobile values in brackets.

## Text styles

| Style name | Family | Size (px) | Line height | Weight | Use |
|---|---|---|---|---|---|
| `Display / 40` | Manrope | 40 (32) | 1.15 | 700 (dark 600) | Report title, cover headline |
| `Heading / H1 / 28` | Manrope | 28 (24) | 1.2 | 700 (dark 600) | Page title |
| `Heading / H2 / 22` | Manrope | 22 (20) | 1.3 | 600 (dark 500) | Section title |
| `Heading / H3 / 18` | Manrope | 18 (17) | 1.35 | 600 (dark 500) | Card title |
| `Body / 16` | Inter | 16 (15) | 1.6 | 400 | Paragraphs, advisor answers |
| `Body / Small 14` | Inter | 14 (13) | 1.5 | 400 | Captions under charts, helper text |
| `Label / 12` | Inter | 12 | 1.4 | 500 | Eyebrows, axis ticks, chips (floor size) |
| `Figure / KPI 20` | Inter | 20 | 1.3 | 700 (dark 600) | KPI card values, tabular-nums |
| `Figure / Table 14` | Inter | 14 | 1.4 | 500 | Table amounts, tabular-nums, right-aligned |
| `Figure / Donut centre 18` | Inter | 18 | 1.2 | 600 | Donut centre total, tabular-nums |

Figma: create each as a Text Style. Turn on "tabular numbers" (OpenType `tnum`) on every `Figure /` style.

## Colour styles used with type

| Name | Light | Dark | Contrast (on bg) |
|---|---|---|---|
| `Text / Primary` | #0F172A | #F1F5F9 | 17.9:1 (light) |
| `Text / Muted` | #475569 | #CBD5E1 | 7.6:1 (light) |
| `Text / Faint` (captions only) | #64748B | #94A3B8 | 4.8:1 (light), 7.0:1 (dark) |
| `Accent / Text` | #0F766E | #14B8A6 | 5.5:1 light; 7.2:1 dark (not #0F766E: 3.3:1 on #0F172A) |
| `Accent / On solid` | #FFFFFF | #0F172A | 5.5:1 on #0F766E; 7.2:1 on #14B8A6 (white is 2.5:1 on #14B8A6) |

## Rules
- Floor is 12px for labels and axis ticks only. Body text is never below 14px. Table data is never below 13px.
- Headings always use Manrope; every number that a user reads as money uses Inter with tabular figures.
- Devanagari, Bengali, Gujarati, Gurmukhi, Odia and Assamese: line height 1.7; Tamil, Telugu, Kannada and Malayalam: 1.6. Never force Inter on script text.
- Load a script font only when that language is active (`:lang()` in the tokens file). Do not load all 13 subsets on every page.
- Indian digit grouping everywhere: ₹1,24,509.82 (see `inr-format.js`).

## Components
- **KPI card**: Label / 12 (faint) → Figure / KPI 20 → Body / Small 14 (muted). Hero variant uses `Accent / On solid` on `Accent` fill.
- **Donut**: centre `Figure / Donut centre 18` over `Label / 12` "take-home"; legend rows use `Figure / Table 14` for amounts.
- **Table**: header `Label / 12` faint; body `Figure / Table 14`; total row weight 600.
- **Advisor answer**: `Body / 16`, citation chips `Label / 12` with accent outline; Hindi/Bengali blocks at 1.7 line height.
- **Report footer**: `Label / 12` faint.

## Open decisions for you
1. Desktop body is 16px here; the current platform uses 15px. Changing it is a one-line token edit.
2. Figures are Inter per this spec. The current platform uses Manrope for KPI numbers; the spec replaces that.
3. Weights: the variable font files cover the full range, so one file per family is loaded. If bundle size matters, switch to static 500/600/700 (Manrope) and 400/500/600 (Inter) files.
