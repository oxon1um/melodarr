# Product

## Register

product

## Users

Melodarr is for self-hosted music collectors, household media-server users, and admins who run Lidarr with optional Jellyfin accounts. Users browse fresh discovery context, artist pages, albums, singles, and tracks; check whether music is already available; and submit requests without needing to understand Lidarr internals. Shared household users need clear sign-in paths, plain request feedback, and confidence that they are not duplicating library items. Admins complete first-run setup, configure Lidarr and optional Jellyfin login, test service connections, review or auto-approve requests, and troubleshoot failures while maintaining Redis, PostgreSQL, and Docker-based deployments.

## Product Purpose

Melodarr exists to make music discovery and request management feel direct, trustworthy, and lower-friction than operating Lidarr manually. Success means a user can complete the welcome flow, find an artist or album, understand availability, submit a request, and track its state from pending review through Lidarr submission, completion, failure, rejection, or already-in-library feedback without confusion. Success for admins means onboarding, moderation, connection testing, service configuration, and operational recovery are clear enough to run confidently in a self-hosted environment.

## Brand Personality

Warm, capable, and collection-minded. The interface should feel like a reliable control room for a personal music library: task-focused and precise, but not cold or enterprise-heavy. Copy should be concise, plainspoken, and confident.

## Anti-references

Avoid generic SaaS dashboards, neon-on-black media-app cliches, over-decorated cards, nightclub visual language, and anything that makes request status feel ornamental rather than actionable. Avoid hiding operational problems behind vague success states. Avoid marketing-page theatrics inside authenticated workflows.

## Design Principles

1. Make availability legible before action. Users should quickly understand what is already in the library, what can be requested, and what requires admin review.
2. Keep discovery immersive but accountable. Album art and artist context can carry the browsing experience, while controls and statuses stay precise.
3. Respect admin urgency. Moderation, failures, and settings need clear hierarchy, explicit feedback, and recoverable paths.
4. Favor self-hosted trust. Configuration and system state should feel transparent, durable, and safe rather than cloud-magic opaque.
5. Let warmth support the task. The amber, stone, and dark-room palette should create comfort without reducing contrast or clarity.
6. Treat onboarding as activation. First-run setup and the welcome tour should help people reach a working, connected library quickly.

## Accessibility & Inclusion

Target WCAG AA contrast for text, controls, status indicators, and focus states. Do not rely on color alone for request status or availability. Preserve keyboard navigation for discovery, request actions, admin controls, dialogs, and toasts. Respect reduced-motion preferences and keep motion tied to state changes rather than decoration.
