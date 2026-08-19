#!/bin/bash
# Shared environment setup for backend scripts

ENVIRONMENT="${ENVIRONMENT:-development}"

if [[ "${ENVIRONMENT}" == "production" ]]; then
  echo "Starting in production mode..."
  export NODE_ENV="production"
  DATA_DIR="${DATA_DIR:-/data}"
  export DATABASE_FILE="${DATA_DIR}/production.db"
  export DATABASE_URL="file:${DATABASE_FILE}"
else
  echo "Starting in development mode..."
  export NODE_ENV="development"

  # Dev fallbacks. On the desktop/production install these come from
  # backend/.env (gitignored), but a fresh checkout has no .env, and the
  # Prisma CLI reads DATABASE_URL from the environment — not from the Zod
  # default in src/env.ts — so `prisma db push` dies with P1012 and the
  # server never starts. Only fill in what is genuinely unset.
  export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"
  export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-dev-only-insecure-secret-do-not-use-in-production}"
fi
