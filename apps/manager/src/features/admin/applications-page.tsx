import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { loadAdminApplications, reviewApplication, type AdminApplication } from '@/api/admin';
import { Button } from '@/components/ui/button';

const FIELD_LABELS: Record<string, string> = {
  phone: 'Phone',
  city: 'City',
  vehicle_type: 'Vehicle',
  owns_vehicle: 'Owns vehicle',
  notes: 'Note',
  restaurant_name: 'Restaurant',
  branch_name: 'Branch',
  cuisine: 'Cuisine',
  address: 'Address',
  description: 'Description',
  fssai_number: 'FSSAI',
  owner_name: 'Owner',
};

export function AdminApplicationsPage() {
  const queryClient = useQueryClient();
  const apps = useQuery({ queryKey: ['admin-applications'], queryFn: loadAdminApplications });
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewApplication(id, approve, notes[id]?.trim() ?? ''),
    onSuccess: () => {
      setTab('reviewed');
      void queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
    },
  });
  const rows = apps.data ?? [];
  const visible = useMemo(
    () => rows.filter((row) => (tab === 'pending' ? row.status === 'pending' : row.status !== 'pending')),
    [rows, tab],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase text-primary">Queue</p>
      <h1 className="mt-1 text-3xl font-extrabold">Applications</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Approving a rider adds the rider role. Approving a restaurant creates the first branch and makes them an owner.
      </p>
      <div className="mt-5 flex gap-2">
        {(['pending', 'reviewed'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={
              item === tab
                ? 'rounded-md bg-primary px-3 py-1.5 text-xs font-bold capitalize text-primary-foreground'
                : 'rounded-md border border-border px-3 py-1.5 text-xs font-bold capitalize'
            }
          >
            {item}
          </button>
        ))}
      </div>
      {apps.error ? <p className="mt-4 text-sm font-semibold text-destructive">{(apps.error as Error).message}</p> : null}
      {review.error ? <p className="mt-4 text-sm font-semibold text-destructive">{(review.error as Error).message}</p> : null}
      <div className="mt-5 grid gap-4">
        {visible.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            {tab === 'pending' ? 'Queue is clear.' : 'Nothing reviewed yet.'}
          </p>
        ) : (
          visible.map((row) => <ApplicationCard key={row.id} row={row} notes={notes} setNotes={setNotes} pending={review.isPending} onReview={(approve) => review.mutate({ id: row.id, approve })} />)
        )}
      </div>
    </div>
  );
}

function ApplicationCard({
  row,
  notes,
  setNotes,
  pending,
  onReview,
}: {
  row: AdminApplication;
  notes: Record<string, string>;
  setNotes: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  pending: boolean;
  onReview: (approve: boolean) => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold">{row.kind === 'rider' ? 'Rider' : 'Restaurant owner'}</h2>
          <p className="text-sm text-muted-foreground">
            {row.full_name || 'Unnamed'} · {row.email || row.applicant_id}
          </p>
        </div>
        <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-extrabold uppercase">{row.status}</span>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {Object.entries(row.payload)
          .filter(([, value]) => String(value ?? '').trim())
          .map(([key, value]) => (
            <div key={key}>
              <dt className="text-[11px] font-bold uppercase text-muted-foreground">{FIELD_LABELS[key] ?? key}</dt>
              <dd className="text-sm">{String(value)}</dd>
            </div>
          ))}
      </dl>
      {row.review_note ? <p className="mt-3 text-sm text-muted-foreground">Note: {row.review_note}</p> : null}
      {row.status === 'pending' ? (
        <div className="mt-4">
          <textarea
            className="w-full rounded-lg border border-border bg-card p-3 text-sm"
            rows={2}
            placeholder="Optional note to the applicant"
            value={notes[row.id] ?? ''}
            onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
          />
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={pending} onClick={() => onReview(true)}>
              Approve
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => onReview(false)}>
              Reject
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
