import fs from "node:fs";
import path from "node:path";

function readEnvDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return null;
  const line = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith("DATABASE_URL="));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "") : null;
}

function sqlitePathFromUrl(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("TVM-01 requires DATABASE_URL to use SQLite (file:...).");
  }
  const raw = databaseUrl.slice("file:".length);
  if (path.isAbsolute(raw)) return raw;
  // Prisma resolves a relative SQLite URL from prisma/schema.prisma.
  return path.resolve(process.cwd(), "prisma", raw);
}

const databaseUrl = readEnvDatabaseUrl();
const databasePath = sqlitePathFromUrl(databaseUrl);
if (!fs.existsSync(databasePath)) {
  console.log(`[TVM] no SQLite file to back up yet: ${databasePath}`);
  process.exit(0);
}

const backupDirectory = path.join(path.dirname(databasePath), "backups");
const backupPath = path.join(backupDirectory, `${path.basename(databasePath)}.pre-tvm-01-02.bak`);
fs.mkdirSync(backupDirectory, { recursive: true });
if (fs.existsSync(backupPath)) {
  console.log(`[TVM] SQLite backup already exists: ${backupPath}`);
} else {
  fs.copyFileSync(databasePath, backupPath);
  console.log(`[TVM] SQLite backup created: ${backupPath}`);
}
