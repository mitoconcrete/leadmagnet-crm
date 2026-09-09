#!/bin/sh
set -e
cd /repo
pnpm --filter api migration:run
pnpm --filter api seed
exec node apps/api/dist/main.js
