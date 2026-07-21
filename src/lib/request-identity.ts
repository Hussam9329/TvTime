export type RequestAuthMode = "authenticated" | "public" | "invalid";
export type RequestIdentityErrorCode = "AUTH_CONFIGURATION_ERROR" | "UNAUTHORIZED";

const DEFAULT_USER_ID = "cinetrack_default";

function sanitizeRequestUserId(userId?: string | null): string {
  const trimmed = String(userId ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : DEFAULT_USER_ID;
}

export class RequestIdentityError extends Error {
  readonly code: RequestIdentityErrorCode;

  constructor(code: RequestIdentityErrorCode) {
    super(code === "UNAUTHORIZED" ? "Authentication required." : "Authentication configuration is invalid.");
    this.name = "RequestIdentityError";
    this.code = code;
  }
}

export interface RequestIdentityInput {
  mode: RequestAuthMode;
  sessionUserId?: string | null;
  queryUserId?: string | null;
  headerUserId?: string | null;
}

/**
 * Resolve ownership with explicit precedence.
 *
 * In authenticated mode, untrusted query/header values are never considered.
 * Legacy selectors remain available only in explicit non-production public mode.
 */
export function resolveRequestIdentity(input: RequestIdentityInput): string {
  if (input.mode === "invalid") {
    throw new RequestIdentityError("AUTH_CONFIGURATION_ERROR");
  }

  if (input.mode === "authenticated") {
    if (!input.sessionUserId) throw new RequestIdentityError("UNAUTHORIZED");
    return sanitizeRequestUserId(input.sessionUserId);
  }

  return sanitizeRequestUserId(input.queryUserId || input.headerUserId);
}
