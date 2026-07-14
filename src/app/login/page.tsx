"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, Film } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAuthEnabled(Boolean(data?.authEnabled));
        // If auth is disabled, the middleware already let the request through
        // to this page only because the user typed /login. Bounce to next.
        if (!data?.authEnabled) {
          const next = search.get("next") || "/";
          router.replace(next);
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
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Login failed.");
        return;
      }
      const next = search.get("next") || "/";
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authEnabled) {
    // Auth disabled — middleware already redirected, this is a safety fallback.
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4">
      <Card className="w-full max-w-sm border-border/60 shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Film className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-extrabold">TvTime</CardTitle>
            <CardDescription className="mt-1">
              Sign in to access your cinema library
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
                  autoFocus
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-10" disabled={loading || !password}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-[11px] text-muted-foreground text-center mt-4">
            Your session stays valid for 30 days on this device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
