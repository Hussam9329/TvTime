"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { useNav } from "@/lib/store";
import { getClientUserId, userHeaders, withUserId } from "@/lib/client-user";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const ensureUserId = useNav((s) => s.ensureUserId);
  const userId = useNav((s) => s.userId);

  useEffect(() => {
    ensureUserId();
  }, [ensureUserId]);

  // Warm the global counters as soon as the app boots, not only when the user
  // opens TV Tracking/Stats. This keeps counters visible everywhere and also
  // runs the server-side repair that demotes ongoing shows from Finished to
  // Up To Date and clears locked TV ratings.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = window.setTimeout(() => {
      const stableUserId = userId || getClientUserId();

      void (async () => {
        // Counts endpoint also performs the safe server-side repair. Await it
        // before stats so rating/watch counters do not briefly show stale data.
        await client.prefetchQuery({
          queryKey: ["tv-tracking-counts", stableUserId],
          queryFn: async () => {
            const url = withUserId(new URL("/api/tv-tracking", window.location.origin));
            url.searchParams.set("countsOnly", "true");
            const res = await fetch(url, { headers: userHeaders() });
            if (!res.ok) throw new Error(`TV Tracking counts ${res.status}`);
            return res.json();
          },
          staleTime: 30_000,
        }).catch(() => null);

        await client.prefetchQuery({
          queryKey: ["lib", "stats", stableUserId],
          queryFn: async () => {
            const res = await fetch(withUserId(new URL("/api/library/stats", window.location.origin)), { headers: userHeaders() });
            if (!res.ok) return null;
            return res.json();
          },
          staleTime: 30_000,
        }).catch(() => null);
      })();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [client, userId]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
