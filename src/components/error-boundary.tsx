"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary — catches runtime errors in its children and renders a
 * recovery UI instead of crashing the whole page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <RiskyComponent />
 *   </ErrorBoundary>
 *
 * The default fallback shows a friendly message with "Try again" (resets
 * the boundary, re-mounting children) and "Reload page" (full refresh).
 *
 * For custom UI, pass a fallback render function:
 *   <ErrorBoundary fallback={(err, reset) => <MyErrorUI error={err} onRetry={reset} />}>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for dev debugging.
    console.error("[ErrorBoundary]", error, errorInfo);
    // Send to Sentry in production. If Sentry is not configured (no DSN),
    // this is a no-op — the SDK's captureException checks enabled flag.
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return <DefaultErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const isNetworkError =
    error.message.includes("fetch") ||
    error.message.includes("network") ||
    error.message.includes("Failed to fetch") ||
    error.message.includes("TMDB");

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center">
        <span className="text-rose-500 text-3xl" aria-hidden>
          ⚠
        </span>
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold">
          {isNetworkError ? "Failed to load data" : "An unexpected error occurred"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {isNetworkError
            ? "Check your internet connection and try again. If the problem persists, the server may be temporarily unavailable."
            : error.message || "Please try again or reload the page."}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        <Button onClick={onRetry} variant="default" size="sm">
          Try again
        </Button>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm">
          Reload page
        </Button>
      </div>
    </div>
  );
}
