# Melodarr

Dockerized music request app for [Lidarr](https://lidarr.audio/) with a [Jellyfin](https://jellyfin.org/)-powered discover UI, inspired by [Seerr](https://github.com/seerr-team/seerr).

## Features

- First-run setup wizard with admin account creation
- Browse and discover artists, albums, and tracks via Jellyfin
- Request albums or full artist discographies — automatically submitted to Lidarr
- Optional admin approval flow or auto-approve mode
- Jellyfin SSO login alongside local accounts
- Admin settings panel for Lidarr, Jellyfin, and request configuration
- Rate limiting and audit logging
- Persistent PostgreSQL + Redis storage

## Quick Start

### Docker Compose (Recommended)

```bash
# 1. Generate a session secret
openssl rand -hex 64

# 2. Set SESSION_SECRET in docker-compose.yml or a .env file, then:
docker compose up -d
```

Open `http://localhost:30000` and complete the setup wizard.

### TrueNAS Scale

1. Create a dataset for persistent storage (e.g. `/mnt/pool/apps/melodarr/`)
2. In TrueNAS Apps, select **Custom App**
3. Set the environment variables listed below
4. Map volumes:
   - `/mnt/pool/apps/melodarr/postgres` → `/var/lib/postgresql` (postgres:18-alpine)
   - `/mnt/pool/apps/melodarr/redis` → `/data` (redis:8-alpine)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | — | **Required.** Generate with `openssl rand -hex 64` |
| `DATABASE_URL` | `postgresql://melodarr:melodarr@db:5432/melodarr?schema=public` | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `POSTGRES_USER` | `melodarr` | Database username (docker-compose) |
| `POSTGRES_PASSWORD` | `melodarr` | Database password (docker-compose) |
| `POSTGRES_DB` | `melodarr` | Database name (docker-compose) |

Additional settings (Jellyfin, Lidarr, auto-approve, etc.) can be configured via the admin panel or environment variables — see `.env.example` for all options.

## Ports

- **30000** (host) → **3000** (container)

## Tech Stack

- **Next.js 16** with App Router (React 19)
- **Prisma** (PostgreSQL)
- **Redis** for sessions
- **Tailwind CSS 4**
- **Vitest** for testing
- **Docker** (multi-service compose)

## Development

```bash
nvm use            # Node.js 20
npm install
npm run dev        # starts Next.js dev server
```

Other useful commands:

```bash
npm run build              # production build
npm run lint               # lint checks
npm run test               # run Vitest suite
npm run prisma:generate    # regenerate Prisma client
npm run prisma:push        # push schema to database
npm run prisma:migrate     # run migrations
```

## First Run Setup

1. Open the app URL
2. Create your admin account
3. Go to **Settings** and configure Jellyfin + Lidarr connections
4. Start discovering and requesting music!

## Updating

Your data persists between container updates when using named volumes (default) or host paths. The database and settings are preserved automatically.
