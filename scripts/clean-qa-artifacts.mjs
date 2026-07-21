import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const removableDirs = [
  "download",
  "upload",
  "tool-results",
  "playwright-report",
  "test-results",
  "coverage",
  ".nyc_output",
  "audit",
  ".audit",
];

const removableExactFiles = [
  "scripts/export-test.json",
  "scripts/db-audit-results.log",
  "scripts/live-audit-results.log",
  "scripts/remove-hardcoded-tmdb-key.py",
  "db/custom.db",
];

const removableFilePatterns = [
  /^screenshot-.*\.(png|jpe?g|webp)$/i,
  /^pasted(?:[_ -]?image| content).*\.(png|jpe?g|txt|webp)$/i,
  /^qa.*\.(png|jpe?g|webp)$/i,
  /^worklog\.md$/i,
  /^.*\.trace\.zip$/i,
  /^.*audit-results\.(json|log|txt)$/i,
  /^.*\.py[cod]$/i,
];

function removePath(targetPath) {
  if (!fs.existsSync(targetPath)) return false;
  fs.rmSync(targetPath, { recursive: true, force: true });
  return true;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, fullPath);

    if (
      entry.isDirectory() &&
      ["node_modules", ".next", ".git"].includes(entry.name)
    ) {
      continue;
    }

    if (entry.isDirectory() && entry.name === "__pycache__") {
      if (removePath(fullPath)) {
        console.log(`removed directory: ${relativePath}`);
        removed += 1;
      }
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

let removed = 0;

for (const dir of removableDirs) {
  if (removePath(path.join(root, dir))) {
    console.log(`removed directory: ${dir}`);
    removed += 1;
  }
}

for (const relativeFile of removableExactFiles) {
  if (removePath(path.join(root, relativeFile))) {
    console.log(`removed file: ${relativeFile}`);
    removed += 1;
  }
}

for (const relativeFile of walk(root)) {
  const basename = path.basename(relativeFile);
  if (removableFilePatterns.some((pattern) => pattern.test(basename))) {
    if (removePath(path.join(root, relativeFile))) {
      console.log(`removed file: ${relativeFile}`);
      removed += 1;
    }
  }
}

if (removed === 0) {
  console.log("No QA or local security artifacts found. Project is already clean.");
} else {
  console.log(`Cleaned ${removed} QA/security artifact item(s).`);
}
