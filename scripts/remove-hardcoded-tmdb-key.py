#!/usr/bin/env python3
"""Remove the hardcoded TMDB demo API key from all source files.
Replaces it with a strict process.env.TMDB_API_KEY read that fails closed
when the env var is not set."""
import os
import re
import sys

ROOT = "/home/z/my-project/audit/TvTime"
KEY = "8265bd1679663a7ea12ac168da84d2e8"

# Patterns to replace
# 1. process.env.TMDB_API_KEY || "key"   → process.env.TMDB_API_KEY?.trim() (+ check below)
PATTERN_FALLBACK = re.compile(
    r'process\.env\.TMDB_API_KEY\s*\|\|\s*["\']' + re.escape(KEY) + r'["\']'
)
# 2. const TMDB_API_KEY = "key";  → const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim();
#                                   if (!TMDB_API_KEY) { console.error("..."); process.exit(1); }
PATTERN_HARDCODED = re.compile(
    r'const\s+TMDB_API_KEY\s*=\s*["\']' + re.escape(KEY) + r'["\'];'
)

REPLACEMENT_FALLBACK = 'process.env.TMDB_API_KEY?.trim()'
REPLACEMENT_HARDCODED = (
    'const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim();\n'
    'if (!TMDB_API_KEY) {\n'
    '  console.error("TMDB_API_KEY env var is required. Refusing to start.");\n'
    '  process.exit(1);\n'
    '}'
)

changed_files = []
for dirpath, _, filenames in os.walk(ROOT):
    # skip node_modules and .git
    if "node_modules" in dirpath or ".git" in dirpath:
        continue
    for fn in filenames:
        if not fn.endswith((".ts", ".tsx", ".mjs", ".js")):
            continue
        path = os.path.join(dirpath, fn)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        original = content
        # Apply hardcoded first (more specific), then fallback
        content = PATTERN_HARDCODED.sub(REPLACEMENT_HARDCODED, content)
        content = PATTERN_FALLBACK.sub(REPLACEMENT_FALLBACK, content)
        if content != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            changed_files.append(path)

# Verify no leftovers
leftovers = []
for dirpath, _, filenames in os.walk(ROOT):
    if "node_modules" in dirpath or ".git" in dirpath:
        continue
    for fn in filenames:
        if not fn.endswith((".ts", ".tsx", ".mjs", ".js", ".md")):
            continue
        path = os.path.join(dirpath, fn)
        with open(path, "r", encoding="utf-8") as f:
            if KEY in f.read():
                leftovers.append(path)

print(f"Modified {len(changed_files)} files:")
for p in changed_files:
    print(f"  ✓ {p.replace(ROOT + '/', '')}")

if leftovers:
    print(f"\n⚠️  Key still present in {len(leftovers)} files:")
    for p in leftovers:
        print(f"  ✗ {p.replace(ROOT + '/', '')}")
    sys.exit(1)
print("\n✓ No hardcoded TMDB key remains.")
