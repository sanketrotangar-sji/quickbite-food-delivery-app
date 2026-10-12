/**
 * Optional Sentry (Expo/web). No native SDK — DSN off = no-op.
 * Set EXPO_PUBLIC_SENTRY_DSN in apps/client/.env.
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

const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? "").trim();
const parsed = dsn ? parseDsn(dsn) : null;

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
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? "client",
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name : "Error",
          value: message,
          stacktrace: stack
            ? {
              frames: stack.split("\n").slice(1, 12).map((line) => ({
                filename: "client",
                function: line.trim().slice(0, 200),
              })),
            }
            : undefined,
        },
      ],
    },
    tags: { app: "client" },
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
      },
    );
  } catch {
    // ignore
  }
}
