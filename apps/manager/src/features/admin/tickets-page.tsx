import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  loadAdminTickets,
  setAdminTicketStatus,
  type AdminTicket,
} from '@/api/admin';
import { Button } from '@/components/ui/button';
import type { Database } from '@/integrations/supabase/types';

type TicketStatus = Database['public']['Enums']['ticket_status'];

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved'];

export function AdminTicketsPage() {
  const queryClient = useQueryClient();
  const tickets = useQuery({ queryKey: ['admin-tickets'], queryFn: loadAdminTickets });
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('open');
  const [selected, setSelected] = useState<AdminTicket>();
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) => setAdminTicketStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
    },
  });

  const shown = useMemo(() => {
    const rows = tickets.data ?? [];
    if (statusFilter === 'all') return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [statusFilter, tickets.data]);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase text-primary">Support</p>
      <h1 className="mt-1 text-3xl font-extrabold">Tickets</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Complaints opened via RIO. Update status only — order and customer links stay fixed.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(['all', ...STATUSES] as const).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={statusFilter === item ? 'default' : 'outline'}
            onClick={() => setStatusFilter(item)}
            className="capitalize"
          >
            {item === 'in_progress' ? 'In progress' : item}
          </Button>
        ))}
      </div>

      {tickets.error ? (
        <p className="mt-4 text-sm font-semibold text-destructive">{(tickets.error as Error).message}</p>
      ) : null}
      {update.error ? (
        <p className="mt-4 text-sm font-semibold text-destructive">{(update.error as Error).message}</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {shown.map((ticket) => (
          <button
            key={ticket.id}
            type="button"
            onClick={() => setSelected(ticket)}
            className="grid w-full gap-2 rounded-xl border border-border bg-card px-4 py-4 text-left md:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <p className="truncate font-extrabold">{ticket.issue_type}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {ticket.restaurant_name ?? 'Kitchen'} · {ticket.customer_name || ticket.customer_email || 'Customer'} ·{' '}
                {new Date(ticket.created_at).toLocaleString()}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{ticket.description}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-bold uppercase text-primary">{ticket.urgency}</span>
              <span className="text-xs font-bold capitalize text-muted-foreground">
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
          </button>
        ))}
        {!tickets.isLoading && shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No tickets in this filter.
          </p>
        ) : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-primary">{selected.urgency} urgency</p>
                <h2 className="mt-1 text-xl font-extrabold">{selected.issue_type}</h2>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(undefined)}>
                Close
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{selected.description}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="font-semibold">{selected.customer_name || selected.customer_email || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Kitchen</dt>
                <dd className="font-semibold">{selected.restaurant_name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Order</dt>
                <dd className="font-semibold">
                  {selected.order_id.slice(0, 8)}… · {selected.order_status ?? '—'}
                  {selected.order_total != null ? ` · ₹${Math.round(selected.order_total)}` : ''}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {STATUSES.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={selected.status === status ? 'default' : 'outline'}
                  disabled={update.isPending || selected.status === status}
                  className="capitalize"
                  onClick={() => {
                    void update.mutateAsync({ id: selected.id, status }).then(() => {
                      setSelected({ ...selected, status });
                    });
                  }}
                >
                  {status.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
