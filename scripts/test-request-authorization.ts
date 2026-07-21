import assert from "node:assert/strict";
import {
  RequestIdentityError,
  resolveRequestIdentity,
} from "../src/lib/request-identity.ts";
import {
  adminConfirmation,
  isAdminOriginAllowed,
  parseAdminCommandBody,
  parseBearerSecret,
} from "../src/lib/admin-command.ts";

assert.equal(
  resolveRequestIdentity({
    mode: "authenticated",
    sessionUserId: "session-owner",
    queryUserId: "forged-query-user",
    headerUserId: "forged-header-user",
  }),
  "session-owner",
  "the signed session subject must override forged request selectors",
);

assert.throws(
  () => resolveRequestIdentity({ mode: "authenticated", queryUserId: "forged-user" }),
  (error) => error instanceof RequestIdentityError && error.code === "UNAUTHORIZED",
);
assert.throws(
  () => resolveRequestIdentity({ mode: "invalid", sessionUserId: "owner" }),
  (error) => error instanceof RequestIdentityError && error.code === "AUTH_CONFIGURATION_ERROR",
);
assert.equal(resolveRequestIdentity({ mode: "public", queryUserId: " local-user " }), "local-user");
assert.equal(resolveRequestIdentity({ mode: "public", headerUserId: "header-user" }), "header-user");
assert.equal(resolveRequestIdentity({ mode: "public" }), "cinetrack_default");
assert.equal(resolveRequestIdentity({ mode: "public", queryUserId: "x".repeat(200) }).length, 120);

assert.equal(parseBearerSecret("Bearer admin-token"), "admin-token");
assert.equal(parseBearerSecret("bearer admin-token"), "admin-token");
assert.equal(parseBearerSecret("admin-token"), null);
assert.equal(parseBearerSecret("Bearer token with spaces"), null);
assert.equal(parseBearerSecret(null), null);

assert.equal(isAdminOriginAllowed("https://app.example", "https://app.example", "same-origin"), true);
assert.equal(isAdminOriginAllowed("https://evil.example", "https://app.example", "cross-site"), false);
assert.equal(isAdminOriginAllowed("https://evil.example", "https://app.example", "same-site"), false);
assert.equal(isAdminOriginAllowed(null, "https://app.example", null), true, "CLI calls may omit Origin");

const operation = "repair-posters";
assert.deepEqual(parseAdminCommandBody({}, operation), {
  ok: true,
  apply: false,
  input: {},
  confirmation: adminConfirmation(operation),
});

const missingConfirmation = parseAdminCommandBody({ apply: true }, operation);
assert.equal(missingConfirmation.ok, false);
if (!missingConfirmation.ok) {
  assert.equal(missingConfirmation.status, 409);
  assert.equal(missingConfirmation.confirmation, "APPLY:repair-posters");
}

assert.deepEqual(parseAdminCommandBody({ apply: true, confirm: "APPLY:repair-posters" }, operation), {
  ok: true,
  apply: true,
  input: { apply: true, confirm: "APPLY:repair-posters" },
  confirmation: "APPLY:repair-posters",
});
assert.equal(parseAdminCommandBody({ apply: "true" }, operation).ok, false);
assert.equal(parseAdminCommandBody([], operation).ok, false);

console.log("Request identity and admin command tests passed.");
