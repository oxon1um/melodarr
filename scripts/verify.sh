#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.verify.yml"
STARTED_VERIFY_SERVICES=0

cleanup() {
  if [[ "$STARTED_VERIFY_SERVICES" == "1" && "${KEEP_VERIFY_SERVICES:-}" != "true" ]]; then
    docker compose -f "$COMPOSE_FILE" down -v >/dev/null
  fi
}

trap cleanup EXIT

if [[ -z "${DATABASE_URL:-}" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    printf '%s\n' "DATABASE_URL is not set and Docker is not available to start verify services." >&2
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    printf '%s\n' "DATABASE_URL is not set and the Docker daemon is not running." >&2
    printf '%s\n' "Start Docker or provide DATABASE_URL/REDIS_URL for an existing test database." >&2
    exit 1
  fi

  docker compose -f "$COMPOSE_FILE" up -d --wait
  STARTED_VERIFY_SERVICES=1

  export DATABASE_URL="postgresql://melodarr:melodarr@localhost:55432/melodarr?schema=public"
  export REDIS_URL="${REDIS_URL:-redis://localhost:56379}"
else
  export REDIS_URL="${REDIS_URL:-}"
fi

export SESSION_SECRET="${SESSION_SECRET:-verify-session-secret-with-enough-entropy-for-image-signing}"

npm run lint
npm run test
npm run prisma:push
npm run build
npm run test:e2e
