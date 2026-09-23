import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import {
  deleteHighlight,
  loadAdminRestaurants,
  loadHighlights,
  saveHighlight,
  type AdminHighlight,
} from '@/api/admin';
import { Button } from '@/components/ui/button';

type HighlightForm = {
  title: string;
  subtitle: string;
  image_url: string;
  kind: 'offer' | 'video';
  sort_order: string;
  is_active: boolean;
  restaurant_id: string;
  badge: string;
  cta_label: string;
};

const empty: HighlightForm = {
  title: '',
  subtitle: '',
  image_url: '',
  kind: 'offer',
  sort_order: '0',
  is_active: true,
  restaurant_id: '',
  badge: '',
  cta_label: 'Order Now',
};

export function AdminHighlightsPage() {
  const queryClient = useQueryClient();
  const highlights = useQuery({ queryKey: ['admin-highlights'], queryFn: loadHighlights });
  const restaurants = useQuery({ queryKey: ['admin-restaurants'], queryFn: loadAdminRestaurants });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminHighlight | null>(null);
  const [form, setForm] = useState<HighlightForm>(empty);
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setForm(empty);
    setError(null);
    setOpen(true);
  }

  function startEdit(row: AdminHighlight) {
    setEditing(row);
    setForm({
      title: row.title,
      subtitle: row.subtitle ?? '',
      image_url: row.image_url,
      kind: row.kind,
      sort_order: String(row.sort_order),
      is_active: row.is_active,
      restaurant_id: row.restaurant_id ?? '',
      badge: row.badge ?? '',
      cta_label: row.cta_label ?? 'Order Now',
    });
    setError(null);
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.image_url.trim()) throw new Error('Title and image URL are required.');
      if (form.kind === 'offer' && !form.restaurant_id) {
        throw new Error('Link an offer to a restaurant so Order Now opens the right kitchen.');
      }
      await saveHighlight(editing?.id ?? null, {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        image_url: form.image_url.trim(),
        kind: form.kind,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
        restaurant_id: form.restaurant_id || null,
        badge: form.badge.trim() || null,
        cta_label: form.cta_label.trim() || 'Order Now',
      });
    },
    onSuccess: () => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-highlights'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: deleteHighlight,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-highlights'] }),
  });

  const kitchenName = (id: string | null) => {
    if (!id) return 'No kitchen';
    return restaurants.data?.find((row) => row.id === id)?.name ?? 'Kitchen';
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Customer home</p>
          <h1 className="mt-1 text-3xl font-extrabold">Home offers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rotating offer cards on the customer home. Order Now opens the linked restaurant.
          </p>
        </div>
        <Button type="button" onClick={startCreate}>
          Add offer
        </Button>
      </div>
      {highlights.error ? <p className="mt-4 text-sm font-semibold text-destructive">{(highlights.error as Error).message}</p> : null}
      {remove.error ? <p className="mt-4 text-sm font-semibold text-destructive">{(remove.error as Error).message}</p> : null}
      <div className="mt-5 grid gap-3">
        {(highlights.data ?? []).map((row) => (
          <article key={row.id} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3">
            <img src={row.image_url} alt="" className="size-[72px] rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate font-extrabold">{row.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.badge || row.kind} · {kitchenName(row.restaurant_id)} · {row.is_active ? 'Active' : 'Hidden'}
              </p>
              <p className="truncate text-xs text-muted-foreground">{row.subtitle || 'No subtitle'}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="text-xs font-bold text-primary" onClick={() => startEdit(row)}>
                Edit
              </button>
              <button type="button" className="text-xs font-bold text-destructive" onClick={() => void remove.mutate(row.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      <Panel
        open={open}
        title={editing ? 'Edit offer' : 'Add offer'}
        description="Shown on the customer home carousel. Link a restaurant for the Order Now button."
        onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <label className="block text-sm font-bold">
            Title
            <input className="mt-2 w-full rounded-lg border border-border px-3 py-2 font-medium" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="block text-sm font-bold">
            Subtitle
            <input className="mt-2 w-full rounded-lg border border-border px-3 py-2 font-medium" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
          </label>
          <label className="block text-sm font-bold">
            Badge
            <input
              className="mt-2 w-full rounded-lg border border-border px-3 py-2 font-medium"
              placeholder="20% OFF"
              value={form.badge}
              onChange={(event) => setForm({ ...form, badge: event.target.value })}
            />
          </label>
          <label className="block text-sm font-bold">
            Image URL
            <input className="mt-2 w-full rounded-lg border border-border px-3 py-2 font-medium" value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} />
          </label>
          <label className="block text-sm font-bold">
            Restaurant
            <select
              className="mt-2 w-full rounded-lg border border-border px-3 py-2 font-medium"
              value={form.restaurant_id}
              onChange={(event) => setForm({ ...form, restaurant_id: event.target.value })}>
              <option value="">Select kitchen</option>
              {(restaurants.data ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.branch_name ? ` · ${row.branch_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            CTA label
            <input
              className="mt-2 w-full rounded-lg border border-border px-3 py-2 font-medium"
              value={form.cta_label}
              onChange={(event) => setForm({ ...form, cta_label: event.target.value })}
            />
          </label>
          <label className="block text-sm font-bold">
            Kind
            <select className="mt-2 w-full rounded-lg border border-border px-3 py-2 font-medium" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as HighlightForm['kind'] })}>
              <option value="offer">Offer</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label className="block text-sm font-bold">
            Sort order
            <input className="mt-2 w-full rounded-lg border border-border px-3 py-2 font-medium" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-bold">
            Active
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          </label>
          {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
          <Button type="button" onClick={() => void save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Panel({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/40">
      <button className="flex-1" aria-label="Close panel" onClick={onClose} />
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </aside>
    </div>
  );
}
