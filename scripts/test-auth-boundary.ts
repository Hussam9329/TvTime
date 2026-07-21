import assert from "node:assert/strict";
import {
  getAuthConfiguration,
  isProductionDeployment,
  MIN_APP_PASSWORD_LENGTH,
  MIN_SESSION_SECRET_LENGTH,
} from "../src/lib/auth-config.ts";
import { safeNextPath } from "../src/lib/safe-next-path.ts";

const strongPassword = "p".repeat(MIN_APP_PASSWORD_LENGTH);
const strongSessionSecret = "s".repeat(MIN_SESSION_SECRET_LENGTH);

assert.equal(isProductionDeployment({ NODE_ENV: "production" }), true);
assert.equal(isProductionDeployment({ NODE_ENV: "production", VERCEL_ENV: "preview" }), false);

assert.deepEqual(
  getAuthConfiguration({ NODE_ENV: "production" }).mode,
  "invalid",
  "production must not become public when APP_PASSWORD is missing",
);
assert.equal(
  getAuthConfiguration({ NODE_ENV: "production", ALLOW_PUBLIC_MODE: "true" }).code,
  "PRODUCTION_AUTH_REQUIRED",
  "ALLOW_PUBLIC_MODE must not open production",
);
assert.equal(
  getAuthConfiguration({ NODE_ENV: "development" }).code,
  "PUBLIC_MODE_NOT_EXPLICIT",
  "local public mode must be explicitly requested",
);
assert.equal(
  getAuthConfiguration({ NODE_ENV: "development", ALLOW_PUBLIC_MODE: "true" }).mode,
  "public",
);
assert.equal(
  getAuthConfiguration({
    NODE_ENV: "development",
    APP_PASSWORD: "too-short",
    SESSION_SECRET: strongSessionSecret,
  }).code,
  "WEAK_APP_PASSWORD",
);
assert.equal(
  getAuthConfiguration({ NODE_ENV: "development", APP_PASSWORD: strongPassword }).code,
  "SESSION_SECRET_REQUIRED",
);
assert.equal(
  getAuthConfiguration({
    NODE_ENV: "development",
    APP_PASSWORD: strongPassword,
    SESSION_SECRET: " ".repeat(MIN_SESSION_SECRET_LENGTH),
  }).code,
  "SESSION_SECRET_REQUIRED",
  "whitespace-only session secrets must be rejected",
);
assert.equal(
  getAuthConfiguration({
    NODE_ENV: "development",
    APP_PASSWORD: strongPassword,
    SESSION_SECRET: "short",
  }).code,
  "WEAK_SESSION_SECRET",
);

const ready = getAuthConfiguration({
  NODE_ENV: "production",
  APP_USERNAME: " owner ",
  APP_PASSWORD: strongPassword,
  SESSION_SECRET: strongSessionSecret,
});
assert.equal(ready.mode, "authenticated");
assert.equal(ready.ownerUsername, "owner");
assert.equal(ready.ownerPassword, strongPassword);
assert.equal(ready.sessionSecret, strongSessionSecret);

const safePaths = [
  [null, "/"],
  ["", "/"],
  ["/", "/"],
  ["/tv/42?tab=episodes#season-2", "/tv/42?tab=episodes#season-2"],
  [" /movies ", "/movies"],
  ["https://attacker.example/", "/"],
  ["//attacker.example/", "/"],
  ["/\\attacker.example/", "/"],
  ["javascript:alert(1)", "/"],
  ["data:text/html,attack", "/"],
  ["\u0000/hidden", "/"],
] as const;

for (const [input, expected] of safePaths) {
  assert.equal(safeNextPath(input), expected, `safeNextPath(${JSON.stringify(input)})`);
}

console.log("Auth configuration and safe redirect tests passed.");
