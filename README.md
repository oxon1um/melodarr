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

1. Copy `.env.example` to `.env` and set `SESSION_SECRET` (generate with `openssl rand -hex 64`).
2. Start services:

```bash
docker compose up --build
```

3. Open `http://localhost:30000` (default port, can be changed in docker-compose.yml).
4. On first run, complete setup by creating the administrator account.
5. Then go to **Settings** and configure Jellyfin + Lidarr services (URLs and API keys).

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

- **Default port**: 30000 (internal container port is always 3000, exposed as 30000 by default in docker-compose.yml)
- **Changing the port**: Edit the host port in docker-compose.yml (first number before the colon)
- Setup must be completed before sign-in.
- Service API keys saved in settings are encrypted using a runtime secret.
- `SESSION_SECRET` must be set in docker-compose.yml or environment variables.
- `APP_URL`, Jellyfin, and Lidarr settings are configured in the Admin Settings UI after initial setup.
