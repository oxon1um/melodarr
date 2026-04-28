#!/bin/sh
set -e

npx prisma generate
npx prisma migrate deploy

exec npm run start
