#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const maxFileBytes = Number.parseInt(
  process.env.REPOSITORY_MAX_FILE_BYTES || String(5 * 1024 * 1024),
  10,
);

const ignoredWalkDirectories = new Set([
  ".git",
  ".next",
  ".vercel",
  "build",
  "coverage",
  "node_modules",
  "out",
]);

const forbiddenExactPaths = new Map([
  ["scripts/export-test.json", "personal library export"],
  ["scripts/db-audit-results.log", "local database audit output"],
  ["scripts/live-audit-results.log", "local live-audit output"],
  ["db/custom.db", "local database file"],
]);

const forbiddenPathPrefixes = new Map([
  [".audit/", "local audit artifact directory"],
  [".tvtime-patch-backup/", "local patch-backup directory"],
  ["audit/", "local audit artifact directory"],
  ["db/", "local database directory"],
  ["download/", "local download directory"],
  ["tool-results/", "agent/tool output directory"],
  ["upload/", "local upload directory"],
]);

const forbiddenPathPatterns = [
  {
    pattern: /(^|\/)\.env(?:\.|$)/i,
    reason: "populated environment file",
    allow: new Set([".env.example"]),
  },
  {
    pattern: /(^|\/)scripts\/export[^/]*\.json$/i,
    reason: "library/data export under scripts",
  },
  {
    pattern: /(^|\/)scripts\/[^/]*audit-results\.(?:json|log|txt)$/i,
    reason: "local audit result",
  },
  {
    pattern: /\.(?:db|db-journal|sqlite|sqlite3)$/i,
    reason: "local database file",
  },
  {
    pattern: /(^|\/)__pycache__\/|\.py[cod]$/i,
    reason: "Python cache artifact",
  },
  {
    pattern: /\.log$/i,
    reason: "runtime or audit log",
  },
  {
    pattern: /(^|\/)(?:pasted[_ -]?image|pasted content|screenshot)[^/]*\.(?:jpe?g|png|txt|webp)$/i,
    reason: "local screenshot or pasted-content artifact",
  },
];

const secretPatterns = [
  {
    name: "credential-bearing PostgreSQL URL",
    pattern: /postgres(?:ql)?:\/\/[^\s:"'`/]+:[^\s@"'`/]+@[^\s/"'`]+\/[^\s"'`]+/gi,
  },
  {
    name: "GitHub access token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,
  },
  {
    name: "OpenAI-style secret key",
    pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    name: "AWS access key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: "32-character API key",
    pattern: /\b[a-fA-F0-9]{32}\b/g,
  },
  {
    name: "private key material",
    pattern: /-----BEGIN (?:EC |OPENSSH |PGP |RSA )?PRIVATE KEY-----/g,
  },
];

const assignedSecretPattern =
  /^\s*(?:export\s+)?(DATABASE_URL|DIRECT_URL|POSTGRES_URL|NEON_DATABASE_URL|TVTIME_AUDIT_DATABASE_URL|SESSION_SECRET|ADMIN_REPAIR_SECRET|TMDB_API_KEY)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/gm;

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/").replace(/^\.\//, "");
}

function listTrackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0 || !result.stdout) return null;

  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map(normalizePath);
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredWalkDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolutePath));
    } else if (entry.isFile()) {
      files.push(normalizePath(path.relative(root, absolutePath)));
    }
  }
  return files;
}

function isLikelyText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8_192));
  return !sample.includes(0);
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.includes("<") ||
    normalized.includes("${") ||
    normalized.includes("example") ||
    normalized.includes("localhost") ||
    normalized.includes("@host/") ||
    normalized.includes(":pass@") ||
    normalized.includes("password") ||
    normalized.includes("placeholder") ||
    normalized.includes("your-") ||
    normalized.includes("your_")
  );
}

function addViolation(violations, filePath, reason) {
  violations.push({ filePath, reason });
}

function inspectPath(filePath, violations) {
  const exactReason = forbiddenExactPaths.get(filePath);
  if (exactReason) addViolation(violations, filePath, exactReason);

  for (const [prefix, reason] of forbiddenPathPrefixes) {
    if (filePath.startsWith(prefix)) addViolation(violations, filePath, reason);
  }

  for (const rule of forbiddenPathPatterns) {
    if (rule.allow?.has(filePath)) continue;
    if (rule.pattern.test(filePath)) addViolation(violations, filePath, rule.reason);
  }
}

function inspectContent(filePath, violations) {
  const absolutePath = path.join(root, filePath);
  if (!fs.existsSync(absolutePath)) return;

  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) return;

  if (stats.size > maxFileBytes) {
    addViolation(
      violations,
      filePath,
      `file exceeds repository limit (${stats.size} > ${maxFileBytes} bytes)`,
    );
    return;
  }

  if (stats.size === 0 || stats.size > 2 * 1024 * 1024) return;

  const buffer = fs.readFileSync(absolutePath);
  if (!isLikelyText(buffer)) return;
  const text = buffer.toString("utf8");

  for (const secret of secretPatterns) {
    secret.pattern.lastIndex = 0;
    let match;
    while ((match = secret.pattern.exec(text)) !== null) {
      if (!isPlaceholder(match[0])) {
        addViolation(violations, filePath, secret.name);
        break;
      }
    }
  }

  assignedSecretPattern.lastIndex = 0;
  let assignment;
  while ((assignment = assignedSecretPattern.exec(text)) !== null) {
    const assignedValue = assignment[2] ?? assignment[3] ?? assignment[4] ?? "";
    if (!isPlaceholder(assignedValue)) {
      addViolation(
        violations,
        filePath,
        `populated ${assignment[1]} assignment`,
      );
      break;
    }
  }
}

if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1) {
  console.error("REPOSITORY_MAX_FILE_BYTES must be a positive integer.");
  process.exit(2);
}

const trackedFiles = listTrackedFiles();
const files = [...new Set(trackedFiles ?? walk(root))].sort();
const source = trackedFiles ? "Git tracked files" : "working-tree files (Git metadata unavailable)";
const violations = [];

for (const filePath of files) {
  inspectPath(filePath, violations);
  inspectContent(filePath, violations);
}

const uniqueViolations = [
  ...new Map(
    violations.map((violation) => [
      `${violation.filePath}\0${violation.reason}`,
      violation,
    ]),
  ).values(),
].sort((a, b) =>
  `${a.filePath}:${a.reason}`.localeCompare(`${b.filePath}:${b.reason}`),
);

if (uniqueViolations.length > 0) {
  console.error(`Repository hygiene check failed (${source}):`);
  for (const violation of uniqueViolations) {
    console.error(`- ${violation.filePath}: ${violation.reason}`);
  }
  console.error("Matched secret values are intentionally not printed.");
  process.exit(1);
}

console.log(`Repository hygiene check passed: ${files.length} ${source.toLowerCase()} inspected.`);
