#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f package.json || ! -f prisma/schema.prisma ]]; then
  echo "ERROR: Run this script from the patched TvTime project." >&2
  exit 1
fi

if [[ -f db/custom.db ]]; then
  mkdir -p db/manual-backups
  stamp="$(date +%Y%m%d-%H%M%S)"
  cp -p db/custom.db "db/manual-backups/custom-before-tvm-${stamp}.db"
  echo "Manual backup: db/manual-backups/custom-before-tvm-${stamp}.db"
fi

if command -v bun >/dev/null 2>&1; then
  bun install
  bun run db:sync
  bun run db:verify
  bun run build
elif command -v npm >/dev/null 2>&1; then
  npm install
  npm run db:sync
  npm run db:verify
  npm run build
else
  echo "ERROR: Bun or npm is required." >&2
  exit 1
fi

echo "TVM-01/02 applied, database verified, and production build completed."
