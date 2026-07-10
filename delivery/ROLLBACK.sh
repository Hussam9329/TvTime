#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-$(pwd)}"
[[ -d "$TARGET_DIR/.git" ]] || { echo "Target must be a Git working tree" >&2; exit 1; }
cd "$TARGET_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Rollback restores tracked files and removes only untracked files introduced by TVM-03/04/05."
fi

git restore --source=HEAD --worktree --staged .
rm -f \
  scripts/test-tv-status-engine.ts \
  scripts/verify-tvm-03-04-05.mjs \
  src/lib/tv-status-engine.ts \
  src/lib/tv-status-repair.ts \
  src/lib/tv-status-server.ts
rm -rf delivery

echo "Code rollback completed. No database command was executed."
