"use client";

/**
 * Top-level recovery UI. It intentionally avoids application components and
 * external styles because the root layout or CSS chunk may be the failing
 * surface.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const buttonBase = {
    minHeight: "44px",
    padding: "0.65rem 1rem",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: 650,
  } as const;

  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          padding: "1rem",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#0a0a0f",
          color: "#fafafa",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <main
          role="alert"
          aria-live="assertive"
          aria-labelledby="global-error-title"
          aria-describedby="global-error-description"
          style={{ textAlign: "center", padding: "2rem", maxWidth: "520px" }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              background: "rgba(225, 29, 72, 0.14)",
              color: "#fb7185",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              fontSize: "2rem",
            }}
            aria-hidden="true"
          >
            ⚠
          </div>

          <h1
            id="global-error-title"
            style={{ fontSize: "1.6rem", lineHeight: 1.2, fontWeight: 750, margin: "0 0 0.6rem" }}
          >
            TvTime could not start
          </h1>
          <p
            id="global-error-description"
            style={{ color: "#a1a1aa", lineHeight: 1.6, fontSize: "0.95rem", margin: "0 0 1.5rem" }}
          >
            No data was changed. Try starting the application again or reload this page.
            {error.digest && (
              <>
                <br />
                <code
                  style={{
                    display: "inline-block",
                    marginTop: "0.75rem",
                    padding: "0.3rem 0.55rem",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  Error ID: {error.digest}
                </code>
              </>
            )}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", justifyContent: "center" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                ...buttonBase,
                background: "#e11d48",
                color: "white",
                border: "1px solid #e11d48",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                ...buttonBase,
                background: "transparent",
                color: "#fafafa",
                border: "1px solid #3f3f46",
              }}
            >
              Reload page
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
