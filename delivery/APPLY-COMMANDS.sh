#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$(pwd)}"
PATCH_FILE="$SCRIPT_DIR/TVM-03-04-05.patch"

fail() { echo "ERROR: $*" >&2; exit 1; }
check_hash() {
  local expected="$1" file="$2"
  [[ -f "$TARGET_DIR/$file" ]] || fail "Missing protected file: $file"
  local actual
  actual="$(sha256sum "$TARGET_DIR/$file" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || fail "Protected file differs from official baseline: $file ($actual)"
}

[[ -f "$PATCH_FILE" ]] || fail "Patch not found: $PATCH_FILE"
[[ -d "$TARGET_DIR" ]] || fail "Target directory not found: $TARGET_DIR"
[[ -d "$TARGET_DIR/.git" ]] || fail "Target must be a Git working tree based on the official clean baseline."

check_hash 1fbff4160f922dc906471f8a2e3de4eea398287e47a457cc70daab1220d8124d prisma/schema.prisma
check_hash a03766d67ee230ac279405c653f27f8b8b0a7f146e6e8671e48d9b6d0f9b4faf package.json
check_hash f4a8214783d8a926a391b27da36102dc2ef0b075e013fd95eca3b5dcd7f53d36 scripts/assert-production-db.mjs
check_hash 6427983b336fdc783833ad08feab538b75286de080701680509663fd27b999c5 next.config.ts

cd "$TARGET_DIR"
[[ -z "$(git status --porcelain)" ]] || fail "Target has uncommitted changes. Use a clean copy of the official baseline."
git apply --check "$PATCH_FILE"
git apply "$PATCH_FILE"

check_hash 1fbff4160f922dc906471f8a2e3de4eea398287e47a457cc70daab1220d8124d prisma/schema.prisma
check_hash a03766d67ee230ac279405c653f27f8b8b0a7f146e6e8671e48d9b6d0f9b4faf package.json
check_hash f4a8214783d8a926a391b27da36102dc2ef0b075e013fd95eca3b5dcd7f53d36 scripts/assert-production-db.mjs
check_hash 6427983b336fdc783833ad08feab538b75286de080701680509663fd27b999c5 next.config.ts

node --experimental-strip-types scripts/test-tv-status-engine.ts
node scripts/verify-tvm-03-04-05.mjs

if [[ "${SKIP_INSTALL_AND_BUILD:-0}" == "1" ]]; then
  echo "Patch and safety checks passed. Install/build skipped by SKIP_INSTALL_AND_BUILD=1."
  exit 0
fi

npm install
npm run lint
npm run build

echo "TVM-03/04/05 applied and verified. No migration, db push, or reset was executed."
