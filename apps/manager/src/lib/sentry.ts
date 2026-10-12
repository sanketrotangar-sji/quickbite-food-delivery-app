/**
 * Optional Sentry (browser envelope). No SDK dep.
 * Set VITE_SENTRY_DSN in apps/manager/.env — leave empty to disable.
 */

type SentryParsed = { publicKey: string; host: string; projectId: string };

function parseDsn(dsn: string): SentryParsed | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "").split("/")[0] ?? "";
    if (!publicKey || !projectId || !url.host) return null;
    return { publicKey, host: url.host, projectId };
  } catch {
    return null;
  }
}

const dsn = (import.meta.env['VITE_SENTRY_DSN'] as string | undefined)?.trim() ?? "";
const parsed = dsn ? parseDsn(dsn) : null;

export function initSentry() {
  if (!parsed || typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    void captureException(event.error ?? event.message, { source: "window.error" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    void captureException(event.reason, { source: "unhandledrejection" });
  });
}

export async function captureException(
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  if (!parsed || !dsn) return;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "client_error";
  const stack = error instanceof Error ? error.stack : undefined;
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    environment: (import.meta.env['VITE_SENTRY_ENVIRONMENT'] as string | undefined) ?? "manager",
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name : "Error",
          value: message,
          stacktrace: stack
            ? {
              frames: stack.split("\n").slice(1, 12).map((line) => ({
                filename: "manager",
                function: line.trim().slice(0, 200),
              })),
            }
            : undefined,
        },
      ],
    },
    tags: { app: "manager" },
    extra: context,
  };
  const envelopeHeader = JSON.stringify({
    event_id: eventId,
    dsn,
    sent_at: new Date().toISOString(),
  });
  const itemHeader = JSON.stringify({ type: "event", content_type: "application/json" });
  try {
    await fetch(
      `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-sentry-envelope" },
        body: `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`,
        keepalive: true,
      },
    );
  } catch {
    // Telemetry must never break the UI.
  }
}
