<a id="readme-top"></a>

# Melodarr

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]



<!-- PROJECT LOGO -->
<br />
<div align="center">
  <p align="center">
    Self-hosted music discovery and requests for Lidarr with optional Jellyfin login.
    <br />
    <br />
    <a href="https://github.com/oxon1um/melodarr/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/oxon1um/melodarr/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#environment-variables">Environment Variables</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#development">Development</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

Melodarr is a self-hosted music discovery and request application for
[Lidarr](https://lidarr.audio/), inspired by [Seerr](https://github.com/seerr-team/seerr).
It gives Lidarr users a friendlier way to discover artists, albums, and singles,
including release matches found from song-title searches. Users can check whether music is
already available and submit requests that can be reviewed, approved, and automatically sent
to Lidarr. [Jellyfin](https://jellyfin.org/) can optionally
be used for login, so household users can sign in with existing Jellyfin credentials instead
of creating separate Melodarr-only accounts.

Key features:

* First-run setup wizard with admin account creation
* Browse and discover artists, albums, and singles via Lidarr-backed discovery
* Search by artist, release, or song title to find matching albums and singles
* Request albums or full artist discographies, then submit them to Lidarr
* Request status tracking from review to Lidarr submission through completed imports
* Optional admin approval flow or auto-approve mode
* Optional Jellyfin login alongside local accounts
* Admin settings panel for Lidarr, Jellyfin, and request configuration
* Rate limiting and audit logging
* Persistent PostgreSQL and Redis storage

<p align="right">(<a href="#readme-top">back to top</a>)</p>



### Built With

* [![Next][Next.js]][Next-url]
* [![React][React.js]][React-url]
* [![Prisma][Prisma.io]][Prisma-url]
* [![PostgreSQL][PostgreSQL.org]][PostgreSQL-url]
* [![Redis][Redis.io]][Redis-url]
* [![Tailwind CSS][TailwindCSS.com]][TailwindCSS-url]
* [![Docker][Docker.com]][Docker-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- GETTING STARTED -->
## Getting Started

The recommended deployment path is Docker Compose, which starts Melodarr, PostgreSQL,
and Redis together.

### Prerequisites

* [Docker](https://www.docker.com/) with Docker Compose
* A secure session secret
  ```sh
  openssl rand -hex 64
  ```
* A running Lidarr instance for submitting music requests
* Optional, but recommended: a running Jellyfin instance for shared user login

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/oxon1um/melodarr.git
   cd melodarr
   ```

2. Create a `.env` file and set `SESSION_SECRET`
   ```sh
   SESSION_SECRET=your-generated-session-secret
   ```

3. Start the Docker Compose stack
   ```sh
   docker compose up -d
   ```

   The included Compose file pins the Melodarr image to `v0.1.0-alpha2`. Update the image tag
   when upgrading to a newer release.

   Docker startup runs checked-in Prisma migrations with `prisma migrate deploy`. New installs
   start from an empty database and apply the bundled initial migration automatically.

4. Open Melodarr
   ```sh
   http://localhost:30000
   ```

5. Complete the first-run setup wizard, then configure Lidarr and optional Jellyfin login
   from Settings.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | - | Required. Generate with `openssl rand -hex 64` |
| `DATABASE_URL` | `postgresql://melodarr:melodarr@db:5432/melodarr?schema=public` | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `POSTGRES_USER` | `melodarr` | Database username for Docker Compose |
| `POSTGRES_PASSWORD` | `melodarr` | Database password for Docker Compose |
| `POSTGRES_DB` | `melodarr` | Database name for Docker Compose |
| `APP_URL` | - | Application URL for OAuth and cookies |
| `JELLYFIN_URL` | - | Optional Jellyfin server URL for shared user login |
| `JELLYFIN_API_KEY` | - | Optional Jellyfin API key for shared user login |
| `LIDARR_URL` | - | Lidarr server URL |
| `LIDARR_API_KEY` | - | Lidarr API key |
| `LIDARR_ROOT_FOLDER` | - | Default Lidarr root folder path |
| `LIDARR_QUALITY_PROFILE_ID` | - | Default Lidarr quality profile ID |
| `LIDARR_METADATA_PROFILE_ID` | - | Default Lidarr metadata profile ID |
| `LIDARR_MONITOR_MODE` | `all` | Default Lidarr monitor mode |
| `REQUEST_AUTO_APPROVE` | `true` | Automatically approve new requests |

Additional Lidarr, optional Jellyfin login, and request settings can be configured in the admin
panel or through environment variables. See `.env.example` for local development defaults.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
## Usage

After the first-run setup wizard:

1. Create the initial admin account.
2. Go to **Settings** and configure the Lidarr connection.
3. Optionally configure Jellyfin login so users can sign in with existing Jellyfin credentials.
4. Browse discovered artists, albums, and singles. Song-title searches return the matching
   album or single release when Lidarr provides enough metadata.
5. Request albums or full artist discographies.
6. Track each request until Lidarr reports the requested album is available.

Request statuses:

| Status | Description |
|--------|-------------|
| `PENDING` | Waiting for admin review when approval is required |
| `APPROVED` | Approved and ready to submit to Lidarr |
| `SUBMITTED` | Sent to Lidarr and waiting for the album to become fully available |
| `COMPLETED` | Lidarr reports the requested album is fully available in the library |
| `FAILED` | Request could not be completed |
| `REJECTED` | Request was declined |
| `ALREADY_EXISTS` | Requested media already exists |

Default Docker port mapping:

| Host | Container |
|------|-----------|
| `30000` | `3000` |

### TrueNAS Scale

1. Create a dataset for persistent storage, such as `/mnt/pool/apps/melodarr/`.
2. In TrueNAS Apps, select **Custom App**.
3. Set the required environment variables.
4. Map `/mnt/pool/apps/melodarr/postgres` to `/var/lib/postgresql` for PostgreSQL.
5. Map `/mnt/pool/apps/melodarr/redis` to `/data` for Redis.

### Upgrading existing alpha installs

Melodarr uses Prisma migrations at container startup. If you ran an early alpha build that created
tables with `prisma db push` before migrations were added, the first upgrade can fail with Prisma
`P3005` because the existing database is not empty and has no migration history yet.

This is a one-time baseline step for those existing databases only. New empty deployments do not
need it.

Run this against the same Docker network and database credentials used by your Melodarr stack, then
restart the app container:

```sh
docker run --rm \
  --network <melodarr-network> \
  --entrypoint npx \
  -e DATABASE_URL='postgresql://melodarr:melodarr@db:5432/melodarr?schema=public' \
  ghcr.io/oxon1um/melodarr:v0.1.0-alpha2 \
  prisma migrate resolve --applied 20260428100000_init
```

On systems that require elevated Docker access, prefix the command with `sudo`. Replace the network,
username, password, host, and database name if your deployment does not use the Compose defaults.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- DEVELOPMENT -->
## Development

Use Node.js 20 for local development, CI, and Docker builds.

1. Install dependencies
   ```sh
   nvm use
   npm install
   ```

2. Start local PostgreSQL and Redis services
   ```sh
   docker compose -f docker-compose.local.yml up -d db redis
   ```

3. Create `.env.local`
   ```sh
   cp .env.example .env.local
   ```

4. Generate Prisma client
   ```sh
   npm run prisma:generate
   ```

5. Start the development server
   ```sh
   npm run dev
   ```

Useful commands:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build on port 3000 |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest suite |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run verify` | Run the project verification script |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:push` | Push schema changes to the database |
| `npm run prisma:migrate` | Apply Prisma migrations |

Docker startup applies checked-in Prisma migrations with `prisma migrate deploy` before starting
the app.

For request status sync and discover-home freshness, make sure your local app can reach the
same Lidarr instance configured in Melodarr settings.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap

See the [open issues](https://github.com/oxon1um/melodarr/issues) for proposed features
and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTRIBUTING -->
## Contributing

Contributions are welcome.

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a pull request.

Before opening a pull request, run:

```sh
npm run verify
```

See [Development Workflow](docs/development-workflow.md) for the required branch, pull request,
and verification-gate process.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- LICENSE -->
## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/oxon1um/melodarr.svg?style=for-the-badge
[contributors-url]: https://github.com/oxon1um/melodarr/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/oxon1um/melodarr.svg?style=for-the-badge
[forks-url]: https://github.com/oxon1um/melodarr/network/members
[stars-shield]: https://img.shields.io/github/stars/oxon1um/melodarr.svg?style=for-the-badge
[stars-url]: https://github.com/oxon1um/melodarr/stargazers
[issues-shield]: https://img.shields.io/github/issues/oxon1um/melodarr.svg?style=for-the-badge
[issues-url]: https://github.com/oxon1um/melodarr/issues
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[Prisma.io]: https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white
[Prisma-url]: https://www.prisma.io/
[PostgreSQL.org]: https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white
[PostgreSQL-url]: https://www.postgresql.org/
[Redis.io]: https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white
[Redis-url]: https://redis.io/
[TailwindCSS.com]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[TailwindCSS-url]: https://tailwindcss.com/
[Docker.com]: https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[Docker-url]: https://www.docker.com/
