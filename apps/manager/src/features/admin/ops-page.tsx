import { useQuery } from '@tanstack/react-query';

import { loadOpsMetrics } from '@quickbite/api/dashboard/admin';
import { StatCard } from '@/components/list-state';

function formatMs(value: number | null) {
  if (value == null) return '—';
  return `${Math.round(value)} ms`;
}

function formatPct(rate: number) {
  return `${Math.round(rate * 1000) / 10}%`;
}

function shortId(id: string | null) {
  if (!id) return '—';
  return id.slice(0, 8);
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AdminOpsPage() {
  const metrics = useQuery({
    queryKey: ['admin-ops-metrics', 24],
    queryFn: () => loadOpsMetrics({ sinceHours: 24 }),
    refetchInterval: 60_000,
  });
  const data = metrics.data;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase text-primary">Observability</p>
      <h1 className="mt-1 text-3xl font-extrabold">Ops</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last 24 hours of orders, RIO AI turns, automation, and payment/admin audit events. Refreshes
        every minute.
      </p>
      {metrics.error ? (
        <p className="mt-4 text-sm font-semibold text-destructive">
          {(metrics.error as Error).message}
        </p>
      ) : null}

      <section className="mt-6">
        <SectionTitle
          title="Order pipeline"
          meaning="How many orders moved through each status. High “placed” with few “preparing” usually means kitchens are slow to accept."
        />
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Orders (24h)" value={data?.orders.total} hint="Placed in window" />
          <StatCard label="Live now" value={data?.orders.live} hint="Placed → out for delivery" />
          <StatCard label="Still placed" value={data?.orders.placed} hint="Waiting on kitchen" />
          <StatCard label="Cancelled" value={data?.orders.cancelled} hint="Includes accept timeouts" />
        </div>
        <BucketList
          empty="No orders in the last 24 hours."
          loading={metrics.isLoading}
          rows={(data?.orders.byStatus ?? []).map((row) => ({
            label: row.status.replaceAll('_', ' '),
            count: row.count,
          }))}
        />
      </section>

      <section className="mt-8">
        <SectionTitle
          title="RIO AI"
          meaning="Each customer chat turn logs latency and errors. Rising error % or p95 latency means the LLM or tools are struggling."
        />
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Turns" value={data?.rio.turns} hint="rio_events rows" />
          <StatCard
            label="Errors"
            value={data?.rio.errors}
            hint={data ? formatPct(data.rio.errorRate) : '—'}
          />
          <StatCard label="p50 latency" value={formatMs(data?.rio.p50Ms ?? null)} hint="Median turn" />
          <StatCard label="p95 latency" value={formatMs(data?.rio.p95Ms ?? null)} hint="Slow tail" />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <BucketList
            title="Providers"
            empty="No RIO turns yet."
            loading={metrics.isLoading}
            rows={(data?.rio.byProvider ?? []).map((row) => ({ label: row.key, count: row.count }))}
          />
          <BucketList
            title="Models"
            empty="No RIO turns yet."
            loading={metrics.isLoading}
            rows={(data?.rio.byModel ?? []).map((row) => ({ label: row.key, count: row.count }))}
          />
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle
          title="Automation"
          meaning="Kitchen-load bumps, auto-assign, and accept-timeout jobs write here. Spikes in timeout kinds mean kitchens are missing the accept window."
        />
        <BucketList
          empty="No automation events in the last 24 hours."
          loading={metrics.isLoading}
          rows={(data?.automationByKind ?? []).map((row) => ({
            label: row.key,
            count: row.count,
          }))}
        />
        <EventTable
          loading={metrics.isLoading}
          empty="No recent automation rows."
          rows={(data?.recentAutomation ?? []).map((row) => ({
            id: row.id,
            primary: row.kind,
            secondary: `Order ${shortId(row.order_id)}`,
            when: formatWhen(row.created_at),
          }))}
        />
      </section>

      <section className="mt-8">
        <SectionTitle
          title="Audit / payments"
          meaning="Admin force-status, refunds, and Stripe webhook outcomes land here. Use this to confirm payments and manual overrides actually happened."
        />
        <BucketList
          empty="No audit events in the last 24 hours."
          loading={metrics.isLoading}
          rows={(data?.auditByAction ?? []).map((row) => ({ label: row.key, count: row.count }))}
        />
        <EventTable
          loading={metrics.isLoading}
          empty="No recent audit rows."
          rows={(data?.recentAudit ?? []).map((row) => ({
            id: row.id,
            primary: row.action,
            secondary: `Order ${shortId(row.order_id)}`,
            when: formatWhen(row.created_at),
          }))}
        />
      </section>
    </div>
  );
}

function SectionTitle({ title, meaning }: { title: string; meaning: string }) {
  return (
    <div>
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{meaning}</p>
    </div>
  );
}

function BucketList({
  title,
  rows,
  empty,
  loading,
}: {
  title?: string;
  rows: { label: string; count: number }[];
  empty: string;
  loading: boolean;
}) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4">
      {title ? <p className="text-xs font-bold uppercase text-muted-foreground">{title}</p> : null}
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{loading ? 'Loading…' : empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate font-semibold capitalize">{row.label}</span>
              <span className="font-extrabold tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventTable({
  rows,
  empty,
  loading,
}: {
  rows: { id: string; primary: string; secondary: string; when: string }[];
  empty: string;
  loading: boolean;
}) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase text-muted-foreground">Recent</p>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{loading ? 'Loading…' : empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="grid gap-1 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-sm font-bold">{row.primary}</p>
                <p className="text-xs text-muted-foreground">{row.secondary}</p>
              </div>
              <p className="text-xs font-semibold text-muted-foreground">{row.when}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
