/**
 * Optional Sentry reporting via ingest API (no SDK).
 * Set Edge secret SENTRY_DSN=https://<key>@oXXXX.ingest.sentry.io/<project>
 */

function parseDsn(dsn: string): { publicKey: string; host: string; projectId: string } | null {
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

export async function captureEdgeException(
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN")?.trim();
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "edge_error";
  const stack = error instanceof Error ? error.stack : undefined;
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    server_name: "supabase-edge",
    environment: Deno.env.get("SENTRY_ENVIRONMENT") ?? "edge",
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name : "Error",
          value: message,
          stacktrace: stack
            ? {
              frames: stack.split("\n").slice(1, 12).map((line) => ({
                filename: "edge",
                function: line.trim().slice(0, 200),
              })),
            }
            : undefined,
        },
      ],
    },
    tags: { runtime: "deno-edge" },
    extra: context,
  };

  const envelopeHeader = JSON.stringify({
    event_id: eventId,
    dsn,
    sent_at: new Date().toISOString(),
  });
  const itemHeader = JSON.stringify({ type: "event", content_type: "application/json" });
  const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`;

  try {
    await fetch(
      `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-sentry-envelope" },
        body,
      },
    );
  } catch {
    // Never fail the request because of telemetry.
  }
}
