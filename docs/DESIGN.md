# Design system

CodeAutomation CRM uses the **"Quiet Pro v2"** design system ported from the HANDLL CRM, re-coloured from the CodeAutomation logo. **If the code and this document disagree, the code wins; fix this file in the same change.**

## 1. Sources of truth
| Concern | File |
|---|---|
| Colour, radius, density, material, motion tokens | `src/app/globals.css` |
| Tailwind mapping (colours, type roles, radii, shadows, easings) | `tailwind.config.ts` |
| Density preference + boot script | `src/lib/appearance.ts` |
| Fonts, `<html>` attributes, theme provider, toaster | `src/app/layout.tsx`, `src/components/theme-provider.tsx` |
| Class merger that understands our tokens | `src/lib/utils.ts` (`cn`) |
| Primitives | `src/components/ui/*` |
| App shell | `src/components/shell/*` |
| Logo | `public/codeautomation-logo.svg`, `src/components/shell/logo.tsx` |

## 2. Principles
- **One accent for actions:** brand blue. Yellow is a small chrome mark only (active-nav edge, active icon tile). Never a button colour.
- **Colour means something.** Success, warning and destructive appear as dots, tints, numerals and icons, never as tile borders or page areas. A zero reads as muted, never red.
- **Surfaces, not boxes.** Cards use the `e1` shadow, which draws a 1 px hairline edge. Never add a `border` class on top. Nested blocks use `rounded-card-inner bg-muted p-3`.
- **One prominent button per view.** Everything else is outline, secondary, tinted, ghost or plain.
- **Sentence case** everywhere. The only uppercase text is one `eyebrow` label per section.
- **Hierarchy from type and space, not lines.**
- **Backdrop blur only on navigation chrome** (side nav, top bar, tab bar, open popovers).
- **People are never chips.** Show a 20 px `UserAvatar` and the name as text.
- **Nothing under 11 px.**
- **Mobile is first-class.** Below `md` controls grow to a 44 px target; everything works at 375 px.
- **No modelled numbers.** Empty states say "No data yet" (SPEC P2).

## 3. Colour tokens
HSL triplets in CSS variables; use the Tailwind class, never the raw value.

### 3.1 Brand (from the logo)
Logo colours: blue `#0A8FFC`, yellow `#F7E022`, black `#1E1E1E`.

| Token (class) | Light | Dark | Use |
|---|---|---|---|
| `--brand` / `--primary` (`bg-brand`, `bg-primary`) | `209 92% 42%` ≈ #096FCE | same | Fills with white text (≈5:1, passes AA). The logo blue itself is only ≈3.2:1 with white, so fills use this deeper blue. |
| `--brand-hover` / `--brand-pressed` | `209 92% 37%` / `209 90% 32%` | `209 92% 48%` / `209 90% 36%` | States |
| `--brand-text` (`text-brand-text`) | `209 92% 38%` | `207 97% 68%` | Blue words, links, icons. **Always use for text, never `text-brand`.** |
| `--brand-tint` (`bg-brand-tint`) | `207 100% 96%` | `207 55% 17%` | Soft fills: selected rows, tinted buttons, icon discs |
| `--brand-bright` | `207 97% 52%` = logo blue | same | Decorative only (progress bar, gradients) |
| `--brand-dark` | `0 0% 12%` = logo black | same | Gradients |
| `--ring` | `209 92% 42%` | `207 97% 68%` | Focus ring |

### 3.2 Workspace accent (tokens keep the ported `line-accent` names)
| Token (class) | Value | Use |
|---|---|---|
| `--line-accent` (`bg-line-accent`) | `54 93% 56%` = logo yellow | Active-nav edge marker, active icon tile in the More sheet, hero banner edge |
| `--line-accent-foreground` | `0 0% 12%` | Text on a yellow fill |
| `--line-accent-text` (`text-line-accent-text`) | = `--brand-text` | Active nav label and tab (blue, readable) |
| `--line-accent-tint` (`bg-line-accent-tint`) | = `--brand-tint` | Active nav pill |

### 3.3 Neutrals and semantics
Page `--background`, raised `--card`, overlays `--popover`, inputs `--field`, tracks `--muted`, secondary text `--muted-foreground`, placeholders only `--tertiary-foreground`, hairlines `--border`, input borders `--input`. Light = cool grey `#F5F5F7` page on white cards; dark = `#111113` page on `#1C1C1E` cards. Semantics: `success`, `warning`, `destructive` each with `-tint`, `-foreground`. Full values: `src/app/globals.css`.

## 4. Type, density, radius, motion
- **Type roles** (not raw sizes): `caption2 caption footnote body callout headline title3 title2 title1 large-title kpi`. Font: system UI stack with Inter as the Windows face.
- **Density:** `html[data-density="comfortable|compact"]` switches every role; user preference in the account menu, applied before first paint.
- **Radius:** `control`, `card`, `overlay`, `sheet`, `pill` (CSS variables; `data-shape` presets `soft`/`square`).
- **Shadows** `e1`–`e4`; **durations** `instant fast base moderate slow`; **easings** `standard enter exit sheet spring`. Reduced-motion is respected.

## 5. App shell
- **lg and up:** frosted left sidebar (collapsible, remembered per browser), top bar with workspace name, ⌘K search, quick-add (+), notifications, theme toggle, account menu.
- **Below lg:** top bar with the logo mark, search, quick-add, account menu; floating bottom tab bar (Home, Contacts, Assignments, Alerts, More).
- **Logo:** full logo in the sidebar; the mark only (logo clipped to its icon) when collapsed and on phones.
- **Keyboard:** `⌘/Ctrl+K` or `/` search, `Q` quick-add, `T` new assignment, `N` next step, `?` shortcuts, `G` then `D C A P T I E N R S` to jump to a section. Single keys pause while typing.
- **Command palette:** pages, create actions, appearance. Record search arrives with Phase 2 and must use the same visibility rules as every other read.

## 6. Component inventory (`src/components/ui`)
Button, Input, Select, Checkbox, Switch, Label, Badge, Card, Tabs, Table, Dialog, Sheet, Drawer, DropdownMenu, Command, Tooltip, Skeleton, Progress, Separator, SegmentedControl, ConfirmDialog, PageHeader, SectionHeader, Stat/StatGroup, EmptyState, Panel, Kbd, CountUp. Use these; do not hand-roll equivalents.

## 7. New screen checklist
1. Route under `src/app/(app)/<section>/page.tsx` with `export const metadata = { title }`.
2. Start with `PageHeader` (title, one-line subtitle, optional icon, at most one primary action).
3. Group content with `SectionHeader` and `Card`; metrics with `Stat`; lists with `Table`.
4. Provide loading (`Skeleton`), empty (`EmptyState`) and error states.
5. Colours and sizes only through tokens and type roles. No hex, no `text-[13px]`.
6. Check light, dark, compact and 375 px.
7. Respect permissions: hide what the role can't use, but rely on the API and database to enforce.

## 8. Never
- A raw hex colour or arbitrary `text-[..px]` in components.
- `text-brand` for words (use `text-brand-text`).
- Yellow on a button or as body text.
- A second border on a card, or a blur on a list row.
- Uppercase labels other than the single `eyebrow`.
- A number that isn't backed by a real record.
