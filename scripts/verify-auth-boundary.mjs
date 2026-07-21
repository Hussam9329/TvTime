#!/usr/bin/env node
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const failures = [];
const requireText = (path, pattern, message) => {
  const source = read(path);
  if (!pattern.test(source)) failures.push(message);
};
const forbidText = (path, pattern, message) => {
  const source = read(path);
  if (pattern.test(source)) failures.push(message);
};

requireText("src/lib/auth-config.ts", /PRODUCTION_AUTH_REQUIRED/, "production auth must fail closed");
requireText("src/lib/auth-config.ts", /ALLOW_PUBLIC_MODE/, "public mode must require an explicit flag");
requireText("src/lib/auth.ts", /sessionSecret\(configuration\)/, "JWT signing must use the independent session secret");
forbidText("src/lib/auth.ts", /insecure-fallback|padEnd\(32|APP_PASSWORD\s*\?\?/, "session secrets must not fall back to APP_PASSWORD");
requireText("src/middleware.ts", /configuration\.mode === "invalid"/, "middleware must stop invalid auth configurations");
requireText("src/app/login/page.tsx", /safeNextPath\(search\.get\("next"\)\)/, "login redirects must validate the next path");
forbidText("src/app/login/page.tsx", /router\.replace\(next\)/, "login must not redirect to an unvalidated value");
requireText(".env.example", /ALLOW_PUBLIC_MODE="false"/, "the environment template must document explicit public mode");

if (failures.length > 0) {
  console.error("Auth boundary verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Auth boundary source verification passed.");
