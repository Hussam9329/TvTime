const url = String(process.env.DATABASE_URL || "").trim();

if (!url) {
  console.error("[RECOVERY] DATABASE_URL is missing. Build stopped before connecting to an empty database.");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error("[RECOVERY] DATABASE_URL is invalid. Expected the original PostgreSQL connection URL.");
  process.exit(1);
}

if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
  console.error(`[RECOVERY] Refusing database protocol ${parsed.protocol}. The recovery build requires the original PostgreSQL database.`);
  process.exit(1);
}

console.log(`[RECOVERY] PostgreSQL target confirmed: ${parsed.hostname || 'configured-host'}/${parsed.pathname.replace(/^\//, '') || 'configured-database'}`);
