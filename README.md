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

- **Default port**: 30000 (host port). The container internally always uses port 3000, but this is exposed as 30000 on the host by default in docker-compose.yml.
- **Port mapping**: In docker-compose.yml, the format is `HOST_PORT:CONTAINER_PORT`. The container port (after the colon) should remain 3000. Change the host port (before the colon) to access the UI from a different port on your host machine.
- Setup must be completed before sign-in.
- Service API keys saved in settings are encrypted using a runtime secret.
- `SESSION_SECRET` must be set in docker-compose.yml or environment variables.
- `APP_URL`, Jellyfin, and Lidarr settings are configured in the Admin Settings UI after initial setup.
