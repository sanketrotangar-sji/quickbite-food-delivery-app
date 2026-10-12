import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';

import {
  createCrmCampaign,
  endCrmCampaign,
  launchCrmCampaign,
  loadAdminRestaurants,
  loadCrmCampaignStats,
  loadCrmSegmentCounts,
  loadCrmSegmentMembers,
  type CrmSegment,
} from '@/api/admin';
import { Button } from '@/components/ui/button';

const SEGMENTS: Array<{ id: CrmSegment; label: string; hint: string }> = [
  { id: 'new', label: 'New', hint: '≤1 delivered order' },
  { id: 'frequent', label: 'Frequent', hint: '≥3 delivered in 60 days' },
  { id: 'churned', label: 'Churned', hint: 'Had orders, idle ≥45 days' },
  { id: 'all', label: 'All customers', hint: 'Every customer profile' },
];

type FormState = {
  title: string;
  description: string;
  target_segment: Exclude<CrmSegment, 'active'>;
  discount_percent: string;
  days: string;
  restaurant_id: string;
};

const emptyForm: FormState = {
  title: '',
  description: '',
  target_segment: 'churned',
  discount_percent: '15',
  days: '14',
  restaurant_id: '',
};

export function AdminCrmPage() {
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState<CrmSegment>('churned');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [launchMsg, setLaunchMsg] = useState<string | null>(null);

  const counts = useQuery({ queryKey: ['crm-segment-counts'], queryFn: loadCrmSegmentCounts });
  const members = useQuery({
    queryKey: ['crm-segment-members', segment],
    queryFn: () => loadCrmSegmentMembers(segment),
  });
  const campaigns = useQuery({ queryKey: ['crm-campaign-stats'], queryFn: loadCrmCampaignStats });
  const restaurants = useQuery({ queryKey: ['admin-restaurants'], queryFn: loadAdminRestaurants });

  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of counts.data ?? []) map.set(row.segment, row.member_count);
    return map;
  }, [counts.data]);

  const create = useMutation({
    mutationFn: async () => {
      const discount = Number(form.discount_percent);
      const days = Number(form.days);
      if (!form.title.trim()) throw new Error('Title is required.');
      if (!Number.isFinite(discount) || discount < 1 || discount > 80) {
        throw new Error('Discount must be 1–80%.');
      }
      if (!Number.isFinite(days) || days < 1 || days > 90) {
        throw new Error('Window must be 1–90 days.');
      }
      const starts = new Date();
      const ends = new Date(starts.getTime() + days * 24 * 60 * 60 * 1000);
      return createCrmCampaign({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        target_segment: form.target_segment,
        discount_percent: discount,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        restaurant_id: form.restaurant_id || null,
      });
    },
    onSuccess: () => {
      setForm(emptyForm);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['crm-campaign-stats'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const launch = useMutation({
    mutationFn: launchCrmCampaign,
    onSuccess: (result) => {
      setLaunchMsg(`Launched — enrolled ${result.enrolled}, notified ${result.notified}.`);
      void queryClient.invalidateQueries({ queryKey: ['crm-campaign-stats'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const end = useMutation({
    mutationFn: endCrmCampaign,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm-campaign-stats'] }),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <p className="text-xs font-bold uppercase text-primary">A3-T2 · Custom CRM</p>
        <h1 className="mt-1 text-3xl font-extrabold">Campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Segment customers, launch offer campaigns, track enrollments and redemptions through{' '}
          <code className="text-xs">place_order</code>.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {launchMsg ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
          {launchMsg}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['new', 'frequent', 'churned', 'active'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSegment(id)}
            className={`rounded-xl border p-4 text-left transition ${
              segment === id ? 'border-primary bg-primary/10' : 'border-border bg-card'
            }`}
          >
            <p className="text-xs font-bold uppercase text-muted-foreground">{id}</p>
            <p className="mt-1 text-2xl font-extrabold">{countMap.get(id) ?? '—'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {SEGMENTS.find((s) => s.id === id)?.hint ?? 'Everyone else'}
            </p>
          </button>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Segment members · {segment}</h2>
            <p className="text-xs text-muted-foreground">Up to 80 rows for preview.</p>
          </div>
        </div>
        {members.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (members.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No customers in this segment yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-semibold">Name</th>
                  <th className="pb-2 pr-3 font-semibold">Email</th>
                  <th className="pb-2 pr-3 font-semibold">Delivered</th>
                  <th className="pb-2 font-semibold">Last delivery</th>
                </tr>
              </thead>
              <tbody>
                {members.data?.map((row) => (
                  <tr key={row.customer_id} className="border-t border-border/70">
                    <td className="py-2 pr-3 font-medium">{row.full_name || '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.email || '—'}</td>
                    <td className="py-2 pr-3">
                      {row.delivered_count}
                      <span className="text-muted-foreground"> · {row.delivered_60d}/60d</span>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {row.last_delivered_at
                        ? new Date(row.last_delivered_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Create campaign</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Draft first, then Launch to enroll the segment and send in-app notifications.
          </p>
          <div className="mt-4 space-y-3">
            <Field label="Title">
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Come back for 20% off"
              />
            </Field>
            <Field label="Description">
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target segment">
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.target_segment}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      target_segment: e.target.value as FormState['target_segment'],
                    }))
                  }>
                  {SEGMENTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Discount %">
                <input
                  type="number"
                  min={1}
                  max={80}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.discount_percent}
                  onChange={(e) => setForm((f) => ({ ...f, discount_percent: e.target.value }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Window (days)">
                <input
                  type="number"
                  min={1}
                  max={90}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.days}
                  onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
                />
              </Field>
              <Field label="Kitchen (optional)">
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.restaurant_id}
                  onChange={(e) => setForm((f) => ({ ...f, restaurant_id: e.target.value }))}>
                  <option value="">All kitchens</option>
                  {(restaurants.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button type="button" disabled={create.isPending} onClick={() => void create.mutateAsync()}>
              {create.isPending ? 'Saving…' : 'Save draft'}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Campaign stats</h2>
          <p className="mt-1 text-xs text-muted-foreground">Enrolled · redeemed · expired unused</p>
          <div className="mt-4 space-y-3">
            {campaigns.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (campaigns.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            ) : (
              campaigns.data?.map((c) => (
                <div key={c.campaign_id} className="rounded-lg border border-border/80 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.target_segment} · {c.discount_percent}% · {c.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {c.status === 'draft' || c.status === 'active' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={launch.isPending}
                          onClick={() => void launch.mutateAsync(c.campaign_id)}>
                          Launch
                        </Button>
                      ) : null}
                      {c.status !== 'ended' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={end.isPending}
                          onClick={() => void end.mutateAsync(c.campaign_id)}>
                          End
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">{c.enrolled}</span> enrolled ·{' '}
                    <span className="font-semibold">{c.redeemed}</span> redeemed ·{' '}
                    <span className="font-semibold">{c.expired_unredeemed}</span> expired unused
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(c.starts_at).toLocaleDateString()} →{' '}
                    {new Date(c.ends_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
