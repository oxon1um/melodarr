# Melodarr

Dockerized music request app for Lidarr with a Seerr-inspired UI.

## Features

- First-run setup wizard (create admin account)
- Discover music by artists, albums, and tracks
- Album request pipeline with automatic submission to Lidarr
- Optional moderation flow for admin approval
- Persistent storage for database and Redis

## Quick Start

### Docker Compose (Recommended)

```bash
# Generate a session secret
openssl rand -hex 64
```

Edit `docker-compose.yml` and set `SESSION_SECRET`, then:

```bash
docker compose up -d
```

Open `http://localhost:30000` and complete the setup wizard.

### TrueNAS Scale

1. Create a dataset for persistent storage (e.g., `/mnt/pool/apps/melodarr/`)
2. In TrueNAS Apps, select "Custom App"
3. Set the following environment variables:
   - `SESSION_SECRET`: Generate with `openssl rand -hex 64`
   - `POSTGRES_USER`: melodarr (or your custom username)
   - `POSTGRES_PASSWORD`: Your secure password
   - `POSTGRES_DB`: melodarr
4. Map volumes:
   - `/mnt/pool/apps/melodarr/postgres` → `/var/lib/postgresql` (postgres:18-alpine)
   - `/mnt/pool/apps/melodarr/redis` → `/data` (redis:8-alpine)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | - | Required. Generate with `openssl rand -hex 64` |
| `POSTGRES_USER` | melodarr | Database username |
| `POSTGRES_PASSWORD` | melodarr | Database password |
| `POSTGRES_DB` | melodarr | Database name |

## Ports

- **30000** (host) → **3000** (container)

## Data Persistence

Data is stored in:
- PostgreSQL database
- Redis for sessions

To persist data between updates, use host path volumes or named volumes.

## First Run Setup

1. Open the app URL
2. Create your admin account
3. Go to **Settings** and configure:
   - App URL
   - Jellyfin server + API key
   - Lidarr server + API key
4. Start discovering and requesting music!

## Updating

When updating the container, your data persists if using named volumes or host paths. The database and settings will be preserved.
