/** Enqueue into public.notification_jobs (service role). Best-effort; never blocks dispatch. */

type AdminClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export async function enqueueNotificationJob(
  admin: AdminClient,
  args: {
    userId: string | null;
    orderId: string | null;
    channel: "push" | "sms" | "in_app";
    templateKey: string;
    payload?: Record<string, unknown>;
    dedupeKey: string;
  },
): Promise<boolean> {
  const { data, error } = await admin.rpc("enqueue_notification_job", {
    p_user_id: args.userId,
    p_order_id: args.orderId,
    p_channel: args.channel,
    p_template_key: args.templateKey,
    p_payload: args.payload ?? {},
    p_dedupe_key: args.dedupeKey,
  });
  if (error) {
    console.error("enqueue_notification_job failed", error.message ?? error);
    return false;
  }
  return Boolean(data);
}

export async function markNotificationJob(
  admin: AdminClient,
  dedupeKey: string,
  status: "processing" | "sent" | "failed" | "skipped",
  errorMessage?: string | null,
): Promise<void> {
  const { error } = await admin.rpc("mark_notification_job", {
    p_dedupe_key: dedupeKey,
    p_status: status,
    p_error: errorMessage ?? null,
  });
  if (error) {
    console.error("mark_notification_job failed", error.message ?? error);
  }
}
