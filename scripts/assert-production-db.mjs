const rawUrl = String(process.env.DATABASE_URL || "").trim();

function refuse(message) {
  console.error(`[database-target] ${message}`);
  process.exit(1);
}

if (!rawUrl) {
  refuse("DATABASE_URL is missing. Build and migration commands fail closed.");
}

let parsed;
try {
  parsed = new URL(rawUrl);
} catch {
  refuse("DATABASE_URL is invalid. Expected a PostgreSQL connection URL.");
}

if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
  refuse(`Refusing database protocol ${parsed.protocol || "unknown"}; PostgreSQL is required.`);
}
if (!parsed.hostname || !parsed.pathname.replace(/^\//, "")) {
  refuse("DATABASE_URL must include a host and database name.");
}
if (/^(user|username|host|localhost)$/i.test(parsed.username)
  || /^(password|pass|changeme)$/i.test(parsed.password)
  || /^(host|example\.com)$/i.test(parsed.hostname)) {
  refuse("DATABASE_URL still appears to contain placeholder credentials.");
}

const auditUrl = String(process.env.TVTIME_AUDIT_DATABASE_URL || "").trim();
if (auditUrl && auditUrl === rawUrl) {
  refuse("DATABASE_URL must not reuse TVTIME_AUDIT_DATABASE_URL.");
}

console.log("[database-target] PostgreSQL deployment target is configured; credentials were not printed.");
