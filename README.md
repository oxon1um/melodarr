# Melodarr

Dockerized request app for Lidarr with a Seerr-inspired UI and first-run setup wizard.

## Features

- First-run setup flow (create local administrator account)
- Services configuration from UI (App URL + Jellyfin + Lidarr URL/API key)
- Discover search for artists, albums, and tracks (with live suggestions)
- Track results map to album downloads (no individual track request in Lidarr)
- Album request pipeline with dedupe + submission to Lidarr
- Optional moderation flow (`REQUEST_AUTO_APPROVE=false`)
- Docker Compose deployment with Postgres + Redis

## Quick Start

1. Copy `.env.example` to `.env` and adjust values if desired.
2. Start services:

```bash
docker compose up --build
```

3. Open `http://localhost:3000`.
4. On first run, complete setup by creating the administrator account.
5. Then go to **Settings** and connect Jellyfin + Lidarr services.

## Environment Variables

See `.env.example`.

## API Overview

- `POST /api/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/search/artists?q=`
- `GET /api/requests`
- `POST /api/requests`
- `PATCH /api/requests/:id` (admin)
- `GET/PUT /api/settings` (admin)
- `GET /api/health/live`
- `GET /api/health/ready`

## Notes

- Setup must be completed before sign-in.
- Service API keys saved in settings are encrypted using a runtime secret.
- If `SESSION_SECRET` is not set, Melodarr generates one and stores it on first run.
- If `SESSION_SECRET` is set, it overrides the stored runtime secret.
- `APP_URL` can be set in Admin Settings and is used for HTTPS-aware login/cookie behavior.
