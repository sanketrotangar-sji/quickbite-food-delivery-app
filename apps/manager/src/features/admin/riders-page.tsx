import { useQuery } from '@tanstack/react-query';

import { loadAdminRiders } from '@/api/admin';

export function AdminRidersPage() {
  const riders = useQuery({ queryKey: ['admin-riders'], queryFn: loadAdminRiders });

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase text-primary">Fleet</p>
      <h1 className="mt-1 text-3xl font-extrabold">Riders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Online status and active deliveries. Read-only ops view.
      </p>

      {riders.error ? (
        <p className="mt-4 text-sm font-semibold text-destructive">{(riders.error as Error).message}</p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        {(riders.data ?? []).map((rider) => (
          <div
            key={rider.id}
            className="grid gap-2 border-b border-border px-4 py-4 last:border-0 md:grid-cols-[1.4fr_1fr_auto] md:items-center"
          >
            <div className="min-w-0">
              <p className="truncate font-extrabold">{rider.full_name?.trim() || 'Rider'}</p>
              <p className="truncate text-xs text-muted-foreground">{rider.email}</p>
            </div>
            <p className="truncate text-sm text-muted-foreground">{rider.phone || 'No phone'}</p>
            <div className="text-right">
              <p className={rider.is_online ? 'text-xs font-bold text-success' : 'text-xs font-bold text-muted-foreground'}>
                {rider.is_online ? 'Online' : 'Offline'}
              </p>
              <p className="text-xs text-muted-foreground">
                {rider.active_orders} active
              </p>
            </div>
          </div>
        ))}
        {!riders.isLoading && (riders.data?.length ?? 0) === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No riders on the platform yet.</p>
        ) : null}
      </div>
    </div>
  );
}
