import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, shortOrderId, type OrderStatus } from '@quickbite/domain';
import { useState } from 'react';

import {
  adminForceOrderStatus,
  adminMarkOrderRefunded,
  loadAdminOrders,
  type AdminOrderRow,
} from '@quickbite/api/dashboard/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

export function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminOrderRow>();
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<OrderStatus>('preparing');
  const orders = useQuery({
    queryKey: ['admin-orders', query],
    queryFn: () => loadAdminOrders(query),
  });
  const force = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Pick an order.');
      return adminForceOrderStatus(selected.id, status, note);
    },
    onSuccess: () => {
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
  const refund = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Pick an order.');
      return adminMarkOrderRefunded(selected.id, note);
    },
    onSuccess: () => {
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelected(undefined);
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase text-primary">Operations</p>
      <h1 className="mt-1 text-3xl font-extrabold">Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Force status or mark a COD refund. Every action needs a note and writes an audit row.
      </p>

      <Input
        className="mt-5 max-w-md bg-card"
        placeholder="Search by order id fragment or address"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {orders.error ? (
        <p className="mt-4 text-sm font-semibold text-destructive">{(orders.error as Error).message}</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {(orders.data ?? []).map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => {
              setSelected(order);
              setStatus(order.status);
            }}
            className="grid w-full gap-2 rounded-xl border border-border bg-card px-4 py-4 text-left md:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <p className="truncate font-extrabold">
                #{shortOrderId(order.id)} · {order.restaurant_name ?? 'Kitchen'}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {order.customer_name ?? 'Customer'} · {order.delivery_address}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold">₹{Math.round(order.total_amount)}</p>
              <p className="text-xs font-bold capitalize text-muted-foreground">
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
                {order.refunded_at ? ' · refunded' : ''}
              </p>
            </div>
          </button>
        ))}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(undefined)}>
        <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>Order #{shortOrderId(selected.id)}</SheetTitle>
                <SheetDescription>{selected.id}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <label className="block text-sm">
                  <span className="font-bold">Force status</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as OrderStatus)}
                  >
                    {ORDER_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {ORDER_STATUS_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="font-bold">Note (required)</span>
                  <Textarea
                    className="mt-1 bg-background"
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Why this admin action is needed"
                  />
                </label>

                {(force.error || refund.error) && (
                  <p className="text-sm font-semibold text-destructive">
                    {((force.error || refund.error) as Error).message}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!note.trim() || force.isPending}
                    onClick={() => void force.mutateAsync()}
                  >
                    Force status
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!note.trim() || refund.isPending || Boolean(selected.refunded_at)}
                    onClick={() => {
                      if (window.confirm('Mark this order as COD refunded and cancel it?')) {
                        void refund.mutateAsync();
                      }
                    }}
                  >
                    Mark COD refund
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
