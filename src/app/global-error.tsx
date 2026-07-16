"use client";

/**
 * global-error.tsx — Next.js App Router's top-level error boundary.
 *
 * This catches errors that escape the regular error.tsx boundary —
 * specifically errors in the root layout itself. It MUST render its own
 * <html> and <body> tags because the root layout is the thing that broke.
 *
 * Kept intentionally minimal: no Tailwind classes (in case the CSS chunk
 * failed to load), no external components (in case they're the source of
 * the error). Just enough to tell the user something went wrong and give
 * them a way to recover.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "480px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(244, 63, 94, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              fontSize: "2rem",
            }}
            aria-hidden
          >
            ⚠
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            حدث خطأ في التطبيق
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "0.9rem", margin: "0 0 1.5rem" }}>
            نعتذر عن هذا الانقطاع. يمكنك المحاولة مرة أخرى أو تحديث الصفحة.
            {error.digest && (
              <>
                <br />
                <code
                  style={{
                    display: "inline-block",
                    marginTop: "0.5rem",
                    padding: "0.25rem 0.5rem",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                  }}
                >
                  Error ID: {error.digest}
                </code>
              </>
            )}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                background: "#e11d48",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              إعادة المحاولة
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "0.5rem 1rem",
                background: "transparent",
                color: "#fafafa",
                border: "1px solid #3f3f46",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
