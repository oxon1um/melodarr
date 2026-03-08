#!/bin/sh
set -e

npx prisma generate
npx prisma db push

exec npm run start
