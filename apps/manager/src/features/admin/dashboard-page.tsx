import { useQuery } from '@tanstack/react-query';

import { loadAdminSummary } from '@/api/admin';

export function AdminDashboardPage() {
  const summary = useQuery({ queryKey: ['admin-summary'], queryFn: loadAdminSummary });
  const data = summary.data;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase text-primary">Platform</p>
      <h1 className="mt-1 text-3xl font-extrabold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Restaurants, people, and orders across QuickBite.</p>
      {summary.error ? <p className="mt-4 text-sm font-semibold text-destructive">{(summary.error as Error).message}</p> : null}
      <section className="mt-6 grid grid-cols-2 items-stretch gap-3 xl:grid-cols-5">
        <Stat label="Restaurants" value={data?.restaurants} hint={`${data?.openRestaurants ?? '—'} open`} />
        <Stat label="Owners" value={data?.owners} hint="People who own kitchens" />
        <Stat label="Pending applications" value={data?.pendingApps} hint="Riders and owners" />
        <Stat label="People" value={data?.people} hint={data?.roleHint ?? 'By role'} />
        <Stat label="Live orders" value={data?.liveOrders} hint="Placed, preparing, ready" />
      </section>
      <section className="mt-5 flex min-h-64 flex-col rounded-xl border border-border bg-card p-5">
        <h2 className="font-extrabold">Recent orders</h2>
        <div className="mt-4 flex flex-1 flex-col divide-y divide-border">
          {(data?.recent ?? []).length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No orders yet, or the admin orders policy is not applied.
            </p>
          ) : (
            data?.recent.map((order) => (
              <div key={order.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <p className="truncate text-sm font-bold">{order.delivery_address}</p>
                <p className="text-xs font-semibold capitalize text-muted-foreground">{order.status.replaceAll('_', ' ')}</p>
                <p className="text-sm font-extrabold">₹{Math.round(order.total_amount)}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | undefined; hint: string }) {
  return (
    <article className="flex h-full min-h-[7.25rem] flex-col rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="font-heading mt-2 text-2xl font-extrabold">{value ?? '—'}</p>
      <p className="mt-1 truncate text-[11px] font-bold text-success">{hint}</p>
    </article>
  );
}
