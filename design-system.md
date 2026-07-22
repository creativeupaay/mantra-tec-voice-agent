# Mantra Tech — Admin Dashboard Design System (v3 — final)

Monochrome-first SaaS ops dashboard, with color reintroduced in exactly one place: call status. Layout, spacing, and component shapes trace back to the original Dribbble reference; the visual language (color, type, motion) is Mantra Tech's own.

**History, briefly:** v1 used a tinted/warm-graphite palette (stat cards in terracotta/sage/clay, dark hero card) — too many colors for a daily-use ops tool. v2 went fully monochrome, including status, using filled/outlined/muted dots instead of color. That over-corrected: status is operational information a support rep needs to triage in under a second, and dot-fill-state alone doesn't clear that bar at 6px, especially with "Escalated" (the most urgent status) getting the *least* visually present treatment (outline, no fill). v3 keeps everything else from v2 and gives status its color back — scoped to a plain dot, never a pill, never bleeding into stat cards or chrome.

---

## 1. Design Rationale

- **Surfaces**: white cards, warm-white page background, near-black for emphasis. No tinted card backgrounds anywhere.
- **Hero/chart card**: flat white, bordered — not a dark filled block.
- **Accent (`--accent`, deep blue)**: reserved exclusively for *live, happening-right-now* states — an active call indicator, a pulsing dot. Never used for stat cards, nav, buttons, or routine status. If it's on screen, something is happening right now.
- **Status color (new in v3)**: the one other place color is allowed. Small solid dot, three distinct hues by urgency — never a background pill, never used decoratively elsewhere.
- **Typography signature**: stat numerals in monospace, tabular figures — everything else stays in the standard UI sans.
- **Trend display**: inline sparkline, not "+2% from last week" text.
- **Icon signature**: a waveform glyph for voice-session avatars — the one deliberate motif tying the icon set back to "this is a voice product."

---

## 2. Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `surface-page` | `#FAFAF9` | Page background |
| `surface-card` | `#FFFFFF` | Cards, sidebar, table rows |
| `text-primary` | `#18181B` | Headings, key numbers, active nav |
| `text-secondary` | `#71717A` | Labels, timestamps, helper text |
| `text-muted` | `#A1A1AA` | Placeholders, disabled states |
| `border` | `#E4E4E7` | Card borders, dividers, hairlines |
| `border-strong` | `#D4D4D8` | Hover states, emphasized dividers |
| `accent` | `#2451DA` | Live-call indicator, alerts — nothing else |
| `accent-bg` | `#EBF0FD` | Accent tint, only behind the live dot/badge itself |

### Status colors (v3 — the only other place color appears)
| Token | Hex | Status | Why this hue |
|---|---|---|---|
| `status-resolved` | `#5B8C5A` | Resolved | Sage green — lowest urgency, already handled |
| `status-escalated` | `#C1554A` | Escalated | Brick red — highest urgency, needs a human now |
| `status-missed` | `#C98A3B` | Missed | Amber — needs follow-up, not yet critical |
| `status-live` | `#2451DA` (= `accent`) | Live / in progress | Same token as accent — a call happening right now is the definition of "live" |

**Rule:** status color is a plain 6–8px solid dot next to plain-text label, never a tinted background pill, never applied to the row, card, or icon around it. Three distinct hue families (green/red/amber) so adjacent statuses in a list are never confusable at a glance, even without reading the label.

**Rule:** outside of the status dot and the live-accent, nothing else on the page gets color. No tinted stat cards, no colored chart bars, no colored buttons beyond the primary near-black. This is what keeps the system from sliding back into v1's noise.

---

## 3. Typography

```css
font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif;
```

| Style | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| Display | 28px | 600 | 1.2 | Page title ("Dashboard") |
| H2 | 20px | 600 | 1.3 | Card section headers ("Call Volume Analytics") |
| H3 | 15px | 600 | 1.4 | Table headers, nav section labels |
| Body | 14px | 400 | 1.5 | Table cells, descriptions |
| Label | 13px | 500 | 1.4 | Stat card labels ("Total Calls Today") |
| Caption | 12px | 400 | 1.4 | Timestamps, helper text |

**Stat numerals — the one typographic signature:**
```css
font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
font-weight: 500;
font-variant-numeric: tabular-nums;
font-size: 28-32px;
```
Used *only* for the big KPI numbers on stat cards. Every other number (table amounts, dates) stays in Inter with `tabular-nums` for column alignment, but not the mono face — the mono swap is a deliberate accent, not a general numerals policy.

---

## 4. Layout & Spacing

- Base unit: 8px grid (4px only for tight icon padding)
- Sidebar: 240px fixed, `surface-card` background, right border `border`
- Content padding: 24px outer, 16px between cards
- Radius: 16px stat/hero cards, 12px table containers, full-round avatars and the live-pulse dot
- Card padding: 20–24px internal
- Grid: 4-column stat row → 2-col tablet → 1-col mobile
- Shadows: none by default; `0 1px 2px rgba(0,0,0,0.04)` on the sidebar only

---

## 5. Components

**Stat card**
White surface, `border` outline, no tint. Label (13px, `text-secondary`) → mono stat number (28–32px) → inline SVG sparkline (~70×18px, single polyline, no fill/axis/gridlines, stroke `text-muted` 1.5px) in place of trend text.

**Hero/chart card**
White, bordered, 16px radius. Bars/lines rendered in `text-primary` at two opacities (100% / 60%) — no color pairing, stays monochrome. Axis labels in `text-secondary`.

**Sidebar nav**
Logo top, 24px padding. Section labels uppercase caption style, `text-secondary`, letter-spacing 0.04em. Nav items: 20px icon + label, 40px row height, active state = `text-primary` + tinted pill background using `border`-level neutral (not accent color). Unread-count badges: small circular pill, `text-primary` bg, white text.

**Table**
Header row in caption style with bottom border. 56px row height, `border` divider between rows. First column: 28px avatar (waveform glyph for voice sessions) + name (14px/500) + subtitle (12px/`text-secondary`) stacked. Status column: dot + label per §2. Amounts/numbers right-aligned, tabular figures.

**Status indicator**
6–8px solid dot in the relevant `status-*` token, plain text label at 13px `text-secondary` beside it. No background pill. Live status uses `status-live` plus the pulse animation (below); the other three states are static.

**Live pulse**
6px solid `accent` dot, 1.6s opacity pulse animation, used *only* on metrics/rows that are true right now (active call, agent currently on a call). Never on historical or resolved rows.

**Buttons**
Primary: `text-primary` (near-black) bg, white text, 8px radius. Secondary/ghost: transparent bg, `border` outline, `text-primary` text. Icon buttons (topbar bell/mail/profile): 36px circle, `surface-card` bg, `border` outline.

---

## 6. Icons

Lucide, 1.75–2px stroke, rounded joins. 20px in nav/topbar, 16px inline, 24px in empty states. Color: `text-secondary` default, `text-primary` on hover/active — icons never carry status color.

| UI element | Icon |
|---|---|
| Dashboard/Home | `home` |
| Call Logs | `phone` |
| Analytics | `bar-chart-2` |
| Settings | `settings` |
| System Usage | `activity` |
| Notifications | `bell` |
| Messages | `mail` |
| Logout | `log-out` |
| View report / external link | `arrow-up-right` |
| Voice session avatar | `audio-waveform` — the signature motif |
| Live/in-progress call | `phone-call`, paired with the live pulse dot, not a separate color |

---

## 7. Voice/Ops-Specific Tokens

| Token | Hex | Use |
|---|---|---|
| `channel-voice` | `#71717A` | Voice channel tag (neutral, since it's the default channel) |
| `channel-ticket` | `#5C7A9E` | Zoho Desk ticket tag |
| `channel-crm` | `#C98A3B` — reuse `status-missed`? **No** — use a distinct `#8B6F47` to avoid clashing with the missed-status meaning | Zoho CRM lookup tag |

Screens to spec next using these same components: **live call feed** (avatar, duration timer, waveform sparkline, live pulse dot), **transcript viewer** (chat-bubble layout, agent vs. caller), **knowledge-base hit confidence bar**.

---

## 8. CSS Variables / Tailwind Config

```css
:root {
  --surface-page: #FAFAF9;
  --surface-card: #FFFFFF;
  --text-primary: #18181B;
  --text-secondary: #71717A;
  --text-muted: #A1A1AA;
  --border: #E4E4E7;
  --border-strong: #D4D4D8;
  --accent: #2451DA;
  --accent-bg: #EBF0FD;
  --status-resolved: #5B8C5A;
  --status-escalated: #C1554A;
  --status-missed: #C98A3B;
  --status-live: #2451DA;
}
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        page: '#FAFAF9',
        card: '#FFFFFF',
        'text-primary': '#18181B',
        'text-secondary': '#71717A',
        'text-muted': '#A1A1AA',
        border: '#E4E4E7',
        'border-strong': '#D4D4D8',
        accent: { DEFAULT: '#2451DA', bg: '#EBF0FD' },
        status: {
          resolved: '#5B8C5A',
          escalated: '#C1554A',
          missed: '#C98A3B',
          live: '#2451DA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: { card: '16px', table: '12px' },
      boxShadow: { sidebar: '0 1px 2px rgba(0,0,0,0.04)' },
    },
  },
};
```

---

## 9. Handoff Instruction for an AI UI Builder

Paste this verbatim along with the token table above:

```
Use the design system in this file. White/near-white surfaces only — no
tinted card backgrounds. Hero and chart cards are flat white with a border,
never a filled dark block. Stat numbers use a monospace font with tabular
figures; every other number stays in Inter. Trends are shown as a small
inline sparkline, never as "+X% from last week" text. Color appears in
exactly two places: (1) --accent (deep blue), used only for live/in-progress
indicators and real-time alerts, and (2) status dots on call/ticket rows,
which use three distinct hues by urgency — status-resolved (sage green),
status-escalated (brick red), status-missed (amber) — always as a small
solid dot next to plain text, never as a colored background pill. Nothing
else on the page — buttons, nav, stat cards, chart bars — takes on color;
they stay in the near-black/gray scale. Icons are Lucide, neutral gray,
never colored to indicate status. The one signature motif is the
audio-waveform icon used for voice-session avatars. Reuse the stat-card,
table, and status-dot component specs exactly — don't invent new spacing,
radius, or color values outside these tokens.
```