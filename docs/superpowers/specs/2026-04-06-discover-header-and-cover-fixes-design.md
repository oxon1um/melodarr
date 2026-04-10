# Discover Header And Cover Fixes Design

## Summary

This change fixes three issues in the current UI:

1. Artist and album cover frames render, but the image content is not visible.
2. The discover empty-state promo block is no longer needed and should be removed.
3. The header layout should be refactored so account controls live in a clearer utility area instead of appearing as content under the main navigation.

The work stays focused on discover and shared header/image components. It does not introduce new features, new navigation items, or a broader design-system rewrite.

## Goals

- Restore visible artist and album covers everywhere the shared cover component is used.
- Remove the current discover empty-state promo section and suggested search chips.
- Refactor the header into a cleaner layout that keeps brand and primary navigation together while moving username/logout into a dedicated utility zone on the far right.
- Keep behavior stable for existing routes and interactions.

## Non-Goals

- No redesign of search behavior or discover result ranking.
- No new onboarding content.
- No auth flow changes beyond moving existing controls.
- No attempt to redesign every page header beyond the shared top navigation component.

## Proposed Changes

### 1. Cover Rendering Fix

The visible symptom is that cover containers render with correct size and borders, but the image itself does not appear. The fix will target the shared `CoverImage` path first so artist and album pages recover together.

Implementation shape:

- Inspect the shared `CoverImage` wrapper and its parent usage for `next/image` fill requirements.
- Correct the minimal layout/styling issue that prevents the image from painting inside its positioned container.
- Preserve the current fallback behavior when no image URL exists.

Expected result:

- Artist hero covers, album hero covers, and grid/list covers render normally.

### 2. Discover Empty-State Removal

The current `EmptyDiscoverState` block shows an icon, descriptive text, and suggested search chips. This block is no longer needed.

Implementation shape:

- Remove the empty-state component from the discover flow.
- Keep the discover page usable without introducing replacement marketing or suggestion content.
- If discover has no query/results, the page should remain intentionally sparse rather than showing the current promo section.

Expected result:

- The discover page focuses on search and results only.

### 3. Broader Header Refactor

The header will be refactored into clearer zones:

- Left: brand
- Center/primary area: main navigation links
- Right: account utilities (`username` pill and logout action)

Implementation shape:

- Replace the current stacked row treatment with a cleaner single primary row on desktop.
- Keep responsive wrapping behavior so narrower widths do not break navigation.
- Preserve active-link styling and existing route set.
- Keep the current sticky behavior unless the refactor reveals a direct layout conflict.

Expected result:

- The main navigation reads as primary navigation.
- Username/logout read as utilities instead of a second content row.
- The header remains usable across desktop and smaller widths.

## Data Flow And Component Boundaries

- `components/ui/cover-image.tsx`
  The shared image rendering boundary. Any image paint/layout fix should live here unless investigation proves the problem is in a specific caller.

- `components/app-header.tsx`
  Owns the shared application header structure and is the right place for the header refactor.

- `components/onboarding/empty-discover-state.tsx` and discover entry flow
  The discover page will stop rendering this block.

## Error Handling

- If a cover image URL is missing, the existing fallback continues to render.
- If the header layout wraps on smaller widths, controls must remain reachable and visually grouped.
- Removing the discover empty state must not create runtime null/conditional rendering errors.

## Testing And Verification

- Add or update a targeted regression test if the cover bug can be captured at the helper/component level.
- Run `npm run lint`.
- Run relevant targeted tests for image-related behavior.
- Run `npm run build` to verify the app still compiles after the header/discover changes.

## Risks

- The cover bug may be caused by a subtle `next/image` layout constraint rather than URL selection, so the fix should stay narrowly focused until the exact rendering cause is confirmed.
- A broader header refactor can create mobile wrapping regressions if the flex layout is not kept simple.
- Removing the discover empty-state block should not leave awkward extra spacing around the search area.

## Recommended Implementation Order

1. Reproduce and fix the shared cover rendering issue.
2. Remove discover empty-state rendering.
3. Refactor the shared header layout.
4. Run lint, targeted tests, and production build verification.
