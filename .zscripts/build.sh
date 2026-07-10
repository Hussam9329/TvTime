#!/bin/bash
exec 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NEXTJS_PROJECT_DIR="${NEXTJS_PROJECT_DIR:-/home/z/my-project}"

if [ ! -d "$NEXTJS_PROJECT_DIR" ]; then
  echo "ERROR: Next.js project directory does not exist: $NEXTJS_PROJECT_DIR"
  exit 1
fi

cd "$NEXTJS_PROJECT_DIR"
export NEXT_TELEMETRY_DISABLED=1

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is missing. Recovery build refuses to package an empty local database."
  exit 1
fi
case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *) echo "ERROR: Recovery build requires the original PostgreSQL DATABASE_URL."; exit 1 ;;
esac

BUILD_DIR="/tmp/build_fullstack_${BUILD_ID:-recovery}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

bun install
bun run build

if [ -d "$NEXTJS_PROJECT_DIR/mini-services" ]; then
  sh "$SCRIPT_DIR/mini-services-install.sh"
  sh "$SCRIPT_DIR/mini-services-build.sh"
  cp "$SCRIPT_DIR/mini-services-start.sh" "$BUILD_DIR/mini-services-start.sh"
  chmod +x "$BUILD_DIR/mini-services-start.sh"
fi

if [ -d ".next/standalone" ]; then
  cp -r .next/standalone "$BUILD_DIR/next-service-dist/"
fi
if [ -d ".next/static" ]; then
  mkdir -p "$BUILD_DIR/next-service-dist/.next"
  cp -r .next/static "$BUILD_DIR/next-service-dist/.next/"
fi
if [ -d "public" ]; then
  cp -r public "$BUILD_DIR/next-service-dist/"
fi
if [ -f "Caddyfile" ]; then
  cp Caddyfile "$BUILD_DIR/"
fi
cp "$SCRIPT_DIR/start.sh" "$BUILD_DIR/start.sh"
chmod +x "$BUILD_DIR/start.sh"

PACKAGE_FILE="${BUILD_DIR}.tar.gz"
(cd "$BUILD_DIR" && tar -czf "$PACKAGE_FILE" .)
echo "Recovery build complete: $PACKAGE_FILE"
