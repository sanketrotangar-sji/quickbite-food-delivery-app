import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  loadAdminRestaurants,
  setAdminRestaurantOpen,
  updateAdminRestaurantOps,
  type AdminRestaurant,
} from '@/api/admin';
import { Button } from '@/components/ui/button';

export function AdminRestaurantsPage() {
  const queryClient = useQueryClient();
  const restaurants = useQuery({ queryKey: ['admin-restaurants'], queryFn: loadAdminRestaurants });
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminRestaurant>();
  const [draft, setDraft] = useState({
    address: '',
    lat: '',
    lng: '',
    offer_percent: '',
    prep_minutes: '',
    capacity_threshold: '',
  });
  const toggle = useMutation({
    mutationFn: ({ id, isOpen }: { id: string; isOpen: boolean }) => setAdminRestaurantOpen(id, isOpen),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
    },
  });
  const saveOps = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('Pick a kitchen.');
      const patch: Parameters<typeof updateAdminRestaurantOps>[1] = {};
      const address = draft.address.trim();
      if (address) patch.address = address;
      if (draft.lat !== '') patch.lat = Number(draft.lat);
      if (draft.lng !== '') patch.lng = Number(draft.lng);
      if (draft.offer_percent !== '') patch.offer_percent = Number(draft.offer_percent);
      if (draft.prep_minutes !== '') patch.prep_minutes = Number(draft.prep_minutes);
      if (draft.capacity_threshold !== '') patch.capacity_threshold = Number(draft.capacity_threshold);
      return updateAdminRestaurantOps(editing.id, patch);
    },
    onSuccess: () => {
      setEditing(undefined);
      void queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
    },
  });
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

  function openEditor(row: AdminRestaurant) {
    setEditing(row);
    setDraft({
      address: row.address,
      lat: row.lat == null ? '' : String(row.lat),
      lng: row.lng == null ? '' : String(row.lng),
      offer_percent: row.offer_percent == null ? '' : String(row.offer_percent),
      prep_minutes: row.prep_minutes == null ? '' : String(row.prep_minutes),
      capacity_threshold: String(row.capacity_threshold ?? 8),
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase text-primary">Partners</p>
      <h1 className="mt-1 text-3xl font-extrabold">Restaurants</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Open/close kitchens, or edit geo, offer %, prep, and capacity threshold.
      </p>
      <input
        className="mt-5 w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm"
        placeholder="Search name, cuisine, owner, or manager"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {restaurants.error ? (
        <p className="mt-4 text-sm font-semibold text-destructive">{(restaurants.error as Error).message}</p>
      ) : null}
      {toggle.error || saveOps.error ? (
        <p className="mt-4 text-sm font-semibold text-destructive">
          {((toggle.error || saveOps.error) as Error).message}
        </p>
      ) : null}
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
              <div
                key={row.id}
                className="grid gap-2 border-b border-border px-4 py-4 last:border-0 md:grid-cols-[1.4fr_1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-extrabold">
                    {row.name}
                    {row.branch_name ? ` · ${row.branch_name}` : ''}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{row.address}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {row.lat != null && row.lng != null
                      ? `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}`
                      : 'No coords'}{' '}
                    · offer {row.offer_percent ?? 0}% · capacity {row.capacity_threshold}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">{row.cuisine || 'Cuisine not set'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.managers.length > 0 ? row.managers.join(', ') : 'No manager assigned'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      row.is_open ? 'text-xs font-bold text-success' : 'text-xs font-bold text-muted-foreground'
                    }
                  >
                    {row.is_open ? 'Open' : 'Closed'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: row.id, isOpen: !row.is_open })}
                  >
                    {row.is_open ? 'Close' : 'Open'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openEditor(row)}>
                    Edit ops
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ))}
        {groups.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            No restaurants match.
          </p>
        ) : null}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="w-full max-w-lg space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-extrabold">Ops · {editing.name}</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(undefined)}>
                Close
              </Button>
            </div>
            {(
              [
                ['address', 'Address'],
                ['lat', 'Latitude'],
                ['lng', 'Longitude'],
                ['offer_percent', 'Offer %'],
                ['prep_minutes', 'Prep minutes'],
                ['capacity_threshold', 'Capacity threshold'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="font-bold">{label}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                  value={draft[key]}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            ))}
            <Button disabled={saveOps.isPending} onClick={() => void saveOps.mutateAsync()}>
              Save ops
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
