export const MIN_APP_PASSWORD_LENGTH = 12;
export const MIN_SESSION_SECRET_LENGTH = 32;

export type AuthMode = "authenticated" | "public" | "invalid";

export type AuthConfigurationCode =
  | "AUTH_READY"
  | "PUBLIC_MODE_EXPLICIT"
  | "PRODUCTION_AUTH_REQUIRED"
  | "PUBLIC_MODE_NOT_EXPLICIT"
  | "WEAK_APP_PASSWORD"
  | "SESSION_SECRET_REQUIRED"
  | "WEAK_SESSION_SECRET";

export type AuthEnvironment = Record<string, string | undefined>;

export interface AuthConfiguration {
  mode: AuthMode;
  code: AuthConfigurationCode;
  production: boolean;
  requiresUsername: boolean;
  ownerUsername: string | null;
  ownerPassword: string | null;
  sessionSecret: string | null;
}

function trimmed(value: string | undefined): string {
  return String(value ?? "").trim();
}

function enabled(value: string | undefined): boolean {
  return trimmed(value).toLowerCase() === "true";
}

/**
 * Vercel Preview builds also use NODE_ENV=production, so VERCEL_ENV must win.
 * Outside Vercel, NODE_ENV=production is treated as a production deployment.
 */
export function isProductionDeployment(env: AuthEnvironment = process.env): boolean {
  const vercelEnvironment = trimmed(env.VERCEL_ENV).toLowerCase();
  if (vercelEnvironment === "production") return true;
  if (vercelEnvironment === "preview" || vercelEnvironment === "development") return false;

  return trimmed(env.NODE_ENV).toLowerCase() === "production";
}

/**
 * Resolve authentication without silently converting a configuration error into
 * a publicly writable application.
 *
 * Public mode is available only when ALLOW_PUBLIC_MODE=true and the deployment
 * is explicitly non-production. Production always requires an independent,
 * strong APP_PASSWORD and SESSION_SECRET.
 */
export function getAuthConfiguration(env: AuthEnvironment = process.env): AuthConfiguration {
  const production = isProductionDeployment(env);
  const ownerUsername = trimmed(env.APP_USERNAME) || null;
  const rawPassword = String(env.APP_PASSWORD ?? "");
  const rawSessionSecret = String(env.SESSION_SECRET ?? "");
  const hasPassword = rawPassword.trim().length > 0;
  const publicModeRequested = enabled(env.ALLOW_PUBLIC_MODE);

  const base = {
    production,
    requiresUsername: ownerUsername !== null,
    ownerUsername,
  };

  if (!hasPassword) {
    if (production) {
      return {
        ...base,
        mode: "invalid",
        code: "PRODUCTION_AUTH_REQUIRED",
        ownerPassword: null,
        sessionSecret: null,
      };
    }

    if (!publicModeRequested) {
      return {
        ...base,
        mode: "invalid",
        code: "PUBLIC_MODE_NOT_EXPLICIT",
        ownerPassword: null,
        sessionSecret: null,
      };
    }

    return {
      ...base,
      mode: "public",
      code: "PUBLIC_MODE_EXPLICIT",
      ownerPassword: null,
      sessionSecret: null,
    };
  }

  if (rawPassword.trim().length < MIN_APP_PASSWORD_LENGTH) {
    return {
      ...base,
      mode: "invalid",
      code: "WEAK_APP_PASSWORD",
      ownerPassword: null,
      sessionSecret: null,
    };
  }

  if (rawSessionSecret.trim().length === 0) {
    return {
      ...base,
      mode: "invalid",
      code: "SESSION_SECRET_REQUIRED",
      ownerPassword: null,
      sessionSecret: null,
    };
  }

  if (rawSessionSecret.trim().length < MIN_SESSION_SECRET_LENGTH) {
    return {
      ...base,
      mode: "invalid",
      code: "WEAK_SESSION_SECRET",
      ownerPassword: null,
      sessionSecret: null,
    };
  }

  return {
    ...base,
    mode: "authenticated",
    code: "AUTH_READY",
    ownerPassword: rawPassword,
    sessionSecret: rawSessionSecret,
  };
}

export function authConfigurationMessage(code: AuthConfigurationCode): string {
  switch (code) {
    case "AUTH_READY":
      return "Authentication is configured.";
    case "PUBLIC_MODE_EXPLICIT":
      return "Explicit non-production public mode is enabled.";
    case "PRODUCTION_AUTH_REQUIRED":
      return "Production requires APP_PASSWORD and SESSION_SECRET.";
    case "PUBLIC_MODE_NOT_EXPLICIT":
      return "Set authentication secrets, or explicitly set ALLOW_PUBLIC_MODE=true for a non-production environment.";
    case "WEAK_APP_PASSWORD":
      return `APP_PASSWORD must be at least ${MIN_APP_PASSWORD_LENGTH} characters.`;
    case "SESSION_SECRET_REQUIRED":
      return "SESSION_SECRET is required and must be independent from APP_PASSWORD.";
    case "WEAK_SESSION_SECRET":
      return `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters.`;
  }
}
