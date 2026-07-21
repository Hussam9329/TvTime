"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, Film, User, ShieldAlert } from "lucide-react";
import { safeNextPath } from "@/lib/safe-next-path";
import { APP_NAME } from "@/lib/brand";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="tvtime-login-loading min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [requiresUsername, setRequiresUsername] = useState(false);
  const [configurationValid, setConfigurationValid] = useState(true);
  const [configurationCode, setConfigurationCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const valid = data?.configurationValid !== false;
        setConfigurationValid(valid);
        setConfigurationCode(typeof data?.configurationCode === "string" ? data.configurationCode : null);
        setAuthEnabled(Boolean(data?.authEnabled));
        setRequiresUsername(Boolean(data?.requiresUsername));

        // Explicit non-production public mode does not need a login screen.
        if (valid && data?.publicMode) {
          router.replace(safeNextPath(search.get("next")));
          return;
        }
      } catch {
        // ignore — assume enabled
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, search]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // For rate-limited responses, show the message but keep the form
        // disabled briefly so the user doesn't immediately retry.
        if (data?.code === "RATE_LIMITED") {
          setError(data?.error || "تم تجاوز عدد المحاولات. حاول لاحقاً.");
        } else if (data?.code === "INVALID_CREDENTIALS") {
          const remaining = data?.remainingAttempts;
          setError(
            typeof remaining === "number" && remaining > 0
              ? `بيانات الدخول غير صحيحة. ${remaining} محاولات متبقية.`
              : "بيانات الدخول غير صحيحة."
          );
        } else {
          setError(data?.error || "فشل تسجيل الدخول.");
        }
        return;
      }
      router.replace(safeNextPath(search.get("next")));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="tvtime-login-loading feedback-state--loading min-h-screen flex items-center justify-center bg-background" role="status" aria-busy="true" aria-label="Checking authentication">
        <Loader2 className="feedback-state__spinner w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!configurationValid) {
    return (
      <div className="tvtime-login-page min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4">
        <Card className="tvtime-login-card w-full max-w-md border-rose-500/30 shadow-2xl">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            </div>
            <CardTitle>Authentication configuration required</CardTitle>
            <CardDescription>
              This deployment is locked because its login secrets are missing or too weak.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Set a strong APP_PASSWORD and an independent SESSION_SECRET, then redeploy.</p>
            {configurationCode && (
              <p className="font-mono text-xs rounded-md bg-muted px-3 py-2" role="status">
                {configurationCode}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!authEnabled) {
    // Explicit public mode redirects above; keep a no-render fallback.
    return null;
  }

  return (
    <div className="tvtime-login-page min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4">
      <Card className="tvtime-login-card w-full max-w-sm border-border/60 shadow-2xl">
        <CardHeader className="tvtime-login-header text-center space-y-3">
          <div className="tvtime-login-mark mx-auto w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Film className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-extrabold">{APP_NAME}</CardTitle>
            <CardDescription className="mt-1">
              Sign in to access your cinema library
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="tvtime-login-form space-y-4">
            {requiresUsername && (
              <div className="tvtime-login-field space-y-2">
                <label
                  htmlFor="username"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="pl-9 h-10"
                    autoComplete="username"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            )}

            <div className="tvtime-login-field space-y-2">
              <label
                htmlFor="password"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="pl-9 h-10"
                  autoFocus={!requiresUsername}
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="tvtime-login-error text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="tvtime-login-submit w-full h-10" disabled={loading || !password || (requiresUsername && !username)}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="tvtime-login-footnote text-[11px] text-muted-foreground text-center mt-4">
            Your session stays valid for 30 days on this device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
