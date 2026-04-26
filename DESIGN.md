---
register: product
source: existing-ui-scan
updated: 2026-04-26
tokens:
  colors:
    background: "#09080a"
    backgroundSoft: "#110f10"
    panel: "#1a1618"
    panelRaised: "#231e20"
    text: "#f5f0eb"
    muted: "#a89888"
    accent: "#f59e0b"
    accentActive: "#fbbf24"
    danger: "#f87171"
    success: "#4ade80"
    edge: "rgba(175, 155, 138, 0.12)"
  typography:
    display: "var(--font-syne), Plus Jakarta Sans, sans-serif"
    body: "var(--font-dm-sans), IBM Plex Sans, Segoe UI, sans-serif"
    numeric: "tabular-nums"
  rounded:
    panel: "1.5rem"
    control: "1rem"
    smallControl: "0.75rem"
    pill: "9999px"
  spacing:
    pageGutterMobile: "1rem"
    pageGutterDesktop: "1.5rem"
    panelPadding: "1.25rem"
  components:
    panel: ".panel"
    field: ".field, .field-select"
    primaryButton: ".btn-primary"
    requestButton: ".btn-request"
    approveButton: ".btn-approve"
    ghostButton: ".btn-ghost"
    statusBadge: ".status-*"
---

## 1. Overview

Melodarr is a product interface for a self-hosted music library. Design serves discovery,
request confidence, and admin control rather than marketing spectacle. The physical scene is a
collector or household admin checking music availability from a dim media-room or desk setup,
where album art should feel warm and immersive but every request state must stay legible.

The current visual system is a restrained warm control-room theme: dark amber and stone surfaces,
soft radial background warmth, sturdy rounded panels, clear status badges, and compact admin
controls. Light mode exists through `prefers-color-scheme`, but the default personality is the
dark, collection-minded surface.

## 2. Colors

The palette is warm dark with amber as the main action color. Use the semantic CSS custom
properties from `styles/globals.css`; do not hardcode one-off component colors.

- Background stack: `--bg`, `--bg-soft`, `--bg-gradient-*`, and `--bg-gradient-base` create a
  dark room with subtle amber, orange, rust, and cream atmosphere.
- Surfaces: `--panel` and `--panel-2` are warm stone-black layers with `--edge` and
  `--edge-bright` borders.
- Text: `--text` is warm cream; `--muted` is stone taupe for secondary metadata.
- Action: `--accent`, `--accent-active`, and `--accent-hover` carry primary actions, active nav,
  request controls, focus rings, and small highlights.
- Status: request states use separate token groups for pending, approved, rejected, submitted,
  failed, and already exists. Always pair status color with label and icon.
- Toasts and badges have dedicated tokens. Keep success, danger, and info feedback distinct from
  primary amber actions.

Future token work should prefer OKLCH and tinted neutrals. The current stylesheet still contains a
few pure extremes in light-mode panels and badge text; do not add more.

## 3. Typography

Melodarr uses a two-family hierarchy:

- Display: `font-display`, backed by `var(--font-syne)`, for brand name, page titles, and section
  headings that need collection-room character.
- Body: `font-body`, backed by `var(--font-dm-sans)`, for forms, tables, metadata, and controls.
- Numeric alignment: global `font-variant-numeric: tabular-nums` supports timestamps, IDs, and
  request status scanning.

Keep page titles around `text-3xl` with semibold display weight. Section headings use
`.section-heading` with tighter tracking. Body text should stay concise; metadata and helper copy
usually sit at `text-sm` or `text-xs` in `--muted`. Avoid flat heading stacks. Give primary titles
noticeably more scale and weight than section labels.

## 4. Elevation

Elevation is tactile and subdued, not glassy. The main `panel` class combines a rounded border,
solid warm surface, layered shadow, and faint inset highlight. This is the default container for
settings, request lists, and major content blocks.

- Use `shadow-panel` for persistent app surfaces, dropdowns, and toasts.
- Use amber glow sparingly for focus, active states, and dominant admin actions.
- Use hover lift only on controls and interactive cards where clickability benefits from feedback.
- Dialogs may use a scrim token and modest blur. Do not make glassmorphism the default surface.
- Loading states use skeleton and shimmer classes. Respect reduced motion through the global media
  query.

## 5. Components

- App header: sticky, compact on scroll, translucent dark surface, amber brand wordmark, active nav
  pills, and clear admin-only links.
- Panels and cards: use `.panel` through the `Card` component for major sections. Avoid nested card
  grids; prefer grouped sections, lists, and inline controls.
- Forms: `.field` and `.field-select` provide rounded warm fields, amber focus, and disabled state.
  Labels should explain the setting, not repeat placeholder text.
- Primary actions: `.btn-primary` is the default submit action. `.btn-request` is tuned for music
  request actions. `.btn-approve` is reserved for the dominant moderation action.
- Secondary actions: `.btn-ghost`, `.icon-btn`, and `.quick-icon` support refresh, reject, delete,
  and card-level controls without competing with primary amber actions.
- Request status: `StatusBadge` combines icon, text, border, fill, and glow. Never rely on color
  alone for pending, approved, submitted, failed, rejected, completed, or already exists.
- Empty states: `.empty-state` should guide the next step, such as browsing music from an empty
  requests view.
- Feedback: toasts are capped, variant-specific, and bottom positioned. Use clear titles like
  Settings, Requests, or Connection Test.
- Cover art: `CoverImage` supports immersive discovery while keeping a simple no-cover fallback.

## 6. Do's and Don'ts

Do:

- Keep availability visible before request controls.
- Use album art and artist context to make discovery feel personal and collection-minded.
- Make admin states direct: connection tests, pending requests, failures, and debug mode should be
  obvious and recoverable.
- Use semantic tokens from `styles/globals.css` and Tailwind extensions from `tailwind.config.ts`.
- Preserve keyboard focus rings, reduced-motion behavior, and status icons.
- Keep copy plainspoken and operationally useful.

Don't:

- Do not turn authenticated workflows into a marketing page.
- Do not use neon nightclub styling, generic SaaS blues, gradient text, decorative glass cards, or
  colored side-stripe accents.
- Do not hide Lidarr or Jellyfin failures behind vague success messages.
- Do not make every discovery item an identical card grid when a list, shelf, or contextual layout
  would communicate better.
- Do not use modals as the first solution for routine settings or request actions.
- Do not communicate request state by color alone.
