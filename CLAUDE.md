# Melodarr

Music discovery and request management for Lidarr/Jellyfin.

## Tech Stack

- Next.js 16 (App Router, React 19)
- Prisma (PostgreSQL)
- Redis for sessions
- Tailwind CSS 4
- Vitest for testing
- Docker (multi-service compose)

## Design Context

### Users
Homelab and self-hosting enthusiasts who manage personal media infrastructure, **but also accessible to family members and non-technical friends** who just want to discover and request music. The interface must be approachable enough for non-technical users while satisfying the expectations of sophisticated self-hosters.

### Brand Personality
**Professional, premium, focused.** The interface should feel like a polished consumer music app (Spotify/Apple Music level of craft), not a hobby project or enterprise software. Sophisticated but warm — not cold or clinical.

### Aesthetic Direction
Inspired by Spotify and Apple Music's polish: clean card-based layouts, rich but restrained use of color, smooth animations that feel intentional, and typography that commands attention without shouting. Dark mode is the primary experience; light mode is a first-class citizen via `prefers-color-scheme`.

**Explicitly NOT:** Generic "AI slop" startup aesthetics — no blue-purple-cyan gradients, no aurora blobs, no generic SaaS landing page vibes. No cluttered interfaces or overly playful/childish design.

### Design Principles

1. **Polish over flash** — Every interaction should feel smooth and intentional. Animations serve purpose, not decoration. Prefer subtle depth and refinement over bold visual gimmicks.

2. **Accessibility is non-negotiable** — Non-technical users (family, friends) must be able to use this confidently. WCAG-compliant contrast, clear affordances, no unexplained icons, and full keyboard/screen reader support.

3. **Content-first hierarchy** — Album art, artist names, and status information are the stars. UI chrome recedes. The design system supports the content, not the reverse.

4. **Dark mode primary, light mode first-class** — Dark is the default and most polished experience. Light mode must be equally well-crafted, not an afterthought.

5. **Consistent design tokens** — All colors via CSS variables, semantic naming (accent-active vs accent-glow), z-index scale, spacing scale. No ad-hoc values scattered through components.

### Design Tokens (current)

**Colors (dark mode):**
- `--bg: #050914` — background
- `--bg-soft: #0c1219` — elevated background
- `--panel: #111827` — panel/card background
- `--panel-2: #1a2234` — secondary panel
- `--text: #f1f5f9` — primary text
- `--muted: #94a3b8` — secondary text
- `--accent: #f59e0b` — amber accent
- `--accent-active: #fbbf24` — active state
- `--accent-hover: #d97706` — hover state
- `--danger: #f87171` — error/danger
- `--success: #4ade80` — success states

**Z-index scale:**
- `--z-base: 0`, `--z-dropdown: 100`, `--z-sticky: 110`, `--z-header: 120`, `--z-modal: 200`, `--z-toast: 300`

**Typography:** Syne (display), DM Sans (body)

**Spacing:** Tailwind default scale + `rounded-2xl` and `rounded-3xl` for panels
