import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { loadAdminRestaurants, type AdminRestaurant } from '@/api/admin';

export function AdminRestaurantsPage() {
  const restaurants = useQuery({ queryKey: ['admin-restaurants'], queryFn: loadAdminRestaurants });
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const shown = (restaurants.data ?? []).filter((row) => {
      if (!needle) return true;
      return `${row.name} ${row.branch_name ?? ''} ${row.cuisine ?? ''} ${row.address} ${row.owner} ${row.managers.join(' ')}`
        .toLowerCase()
        .includes(needle);
    });
    const byOwner = new Map<string, { ownerId: string; owner: string; rows: AdminRestaurant[] }>();
    for (const row of shown) {
      const group = byOwner.get(row.owner_id) ?? { ownerId: row.owner_id, owner: row.owner, rows: [] };
      group.rows.push(row);
      byOwner.set(row.owner_id, group);
    }
    return [...byOwner.values()];
  }, [query, restaurants.data]);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase text-primary">Partners</p>
      <h1 className="mt-1 text-3xl font-extrabold">Restaurants</h1>
      <p className="mt-1 text-sm text-muted-foreground">Grouped by the owner. Each kitchen lists the managers who run it.</p>
      <input
        className="mt-5 w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm"
        placeholder="Search name, cuisine, owner, or manager"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {restaurants.error ? <p className="mt-4 text-sm font-semibold text-destructive">{(restaurants.error as Error).message}</p> : null}
      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <section key={group.ownerId} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-extrabold">{group.owner}</h2>
              <p className="text-xs text-muted-foreground">
                {group.rows.length} restaurant{group.rows.length === 1 ? '' : 's'}
              </p>
            </div>
            {group.rows.map((row) => (
              <div key={row.id} className="grid gap-2 border-b border-border px-4 py-4 last:border-0 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-extrabold">
                    {row.name}
                    {row.branch_name ? ` · ${row.branch_name}` : ''}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{row.address}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">{row.cuisine || 'Cuisine not set'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.managers.length > 0 ? row.managers.join(', ') : 'No manager assigned'}
                  </p>
                </div>
                <span className={row.is_open ? 'text-xs font-bold text-success' : 'text-xs font-bold text-muted-foreground'}>
                  {row.is_open ? 'Open' : 'Closed'}
                </span>
              </div>
            ))}
          </section>
        ))}
        {groups.length === 0 ? <p className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">No restaurants match.</p> : null}
      </div>
    </div>
  );
}
