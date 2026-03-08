# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Melodarr is a Dockerized request application for Lidarr (music download manager) with a Seerr-inspired UI. It allows users to discover and request music albums, with an optional moderation flow for admins.

## Commands

```bash
# Development
npm run dev                    # Start Next.js dev server
npm run build                  # Production build
npm run start                  # Run production server
npm run lint                   # Run Next.js linting

# Database
npm run prisma:generate        # Generate Prisma client
npm run prisma:push            # Push schema to database
npm run prisma:migrate         # Run migrations

# Testing
npm run test                   # Run all tests with Vitest
```

## Architecture

- **Framework**: Next.js 16 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Sessions**: Redis
- **Styling**: Tailwind CSS 4
- **Validation**: Zod
- **Testing**: Vitest

### Directory Structure

- `app/` - Next.js App Router pages and API routes
  - `api/` - REST API endpoints (auth, requests, settings, health)
  - `(auth)/` - Login page
  - `admin/` - Admin settings and request management
  - `discover/` - Music search/discovery
  - `requests/` - User request list
  - `setup/` - First-run wizard
- `lib/` - Core business logic
  - `auth/` - Session management, password hashing
  - `db/` - Prisma client and Redis connection
  - `lidarr/` - Lidarr API client and payload transformation
  - `jellyfin/` - Jellyfin API client
  - `requests/` - Request service logic
  - `settings/` - App configuration store
  - `runtime/` - Runtime secret and app config management
  - `crypto/` - Secret encryption utilities
- `components/` - React components
  - `ui/` - Shared UI components
- `prisma/` - Database schema

### Data Models

- **User** - Admin/user accounts with role-based access
- **Session** - User authentication sessions (stored in Redis)
- **Request** - Music album/artist requests with status tracking
- **AuditLog** - Admin action logging
- **AppConfig** - Single-row configuration for services (Jellyfin/Lidarr URLs, API keys)

### Authentication

- First-run setup creates the initial admin account
- Sessions stored in Redis with cookie-based authentication
- Service API keys (Jellyfin, Lidarr) are encrypted with a runtime secret using AES-GCM

### Request Flow

1. User searches for artist/album in Discover
2. Album request is created (with deduping by foreignAlbumId)
3. If `REQUEST_AUTO_APPROVE=true`, auto-submitted to Lidarr
4. Otherwise, admin approves/rejects in admin panel
5. Approved requests submitted to Lidarr API
