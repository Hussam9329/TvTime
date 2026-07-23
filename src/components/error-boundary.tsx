"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCcw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches runtime errors in a view and provides a recovery path without
 * crashing the entire application shell.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
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
  const normalizedMessage = error.message.toLowerCase();
  const isNetworkError = ["fetch", "network", "tmdb", "offline"].some((term) =>
    normalizedMessage.includes(term),
  );
  const showTechnicalDetails = process.env.NODE_ENV !== "production" && Boolean(error.message);

  return (
    <section
      className="feedback-state feedback-state--error flex flex-col items-center justify-center gap-5 px-4 py-14 text-center"
      role="alert"
      aria-live="assertive"
      aria-labelledby="tvtime-view-error-title"
      aria-describedby="tvtime-view-error-description"
    >
      <div
        aria-hidden="true"
        className="feedback-state__icon flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
      >
        <AlertTriangle className="size-7" />
      </div>

      <div className="space-y-1.5">
        <h2 id="tvtime-view-error-title" className="feedback-state__title text-xl font-bold">
          {isNetworkError ? "We couldn’t load this page" : "Something went wrong"}
        </h2>
        <p
          id="tvtime-view-error-description"
          className="feedback-state__description max-w-md text-sm leading-relaxed text-muted-foreground"
        >
          {isNetworkError
            ? "Check your connection, then try again. The service may also be temporarily unavailable."
            : "Your data has not been changed. Try the action again or reload the application."}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onRetry}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>
        <Button onClick={() => window.location.reload()} variant="outline">
          <RefreshCcw className="size-4" aria-hidden="true" />
          Reload page
        </Button>
      </div>

      {showTechnicalDetails && (
        <details className="max-w-xl rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold text-foreground">
            Technical details
          </summary>
          <code className="mt-2 block whitespace-pre-wrap break-words">{error.message}</code>
        </details>
      )}
    </section>
  );
}
