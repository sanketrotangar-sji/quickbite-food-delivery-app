import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { OrderCard } from "@/components/order-card";
import { OrderDrawer } from "@/components/order-drawer";
import { QuickBiteShell } from "@/components/quickbite-shell";
import { Button } from "@/components/ui/button";
import { ListShell } from "@/components/list-state";
import { useAdvanceOrder, useManagerOrders } from "@/hooks/use-manager-orders";
import type { Order } from "@/lib/quickbite-data";

const statuses = ["all", "placed", "preparing", "ready"] as const;
type OrdersFilter = (typeof statuses)[number];

function isFilter(value: unknown): value is OrdersFilter {
  return statuses.includes(value as OrdersFilter);
}

export const Route = createFileRoute("/orders")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
    status: isFilter(search["status"]) ? search["status"] : "all",
  }),
  head: () => ({
    meta: [
      { title: "Orders — QuickBite" },
      { name: "description", content: "Manage incoming, current, and completed restaurant orders." },
      { property: "og:title", content: "Orders — QuickBite" },
      { property: "og:description", content: "Manage incoming, current, and completed restaurant orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { q, status } = Route.useSearch();
  const ordersQuery = useManagerOrders();
  const orders = ordersQuery.data ?? [];
  const advanceOrder = useAdvanceOrder();
  const [selected, setSelected] = useState<Order>();
  const [filter, setFilter] = useState<OrdersFilter>(status);
  const needle = q.trim().toLowerCase().replace(/^#/, "");
  const shown = orders.filter((order) => {
    const matchesStatus = filter === "all" || order.status === filter;
    if (!matchesStatus) return false;
    if (!needle) return true;
    return (
      order.displayId.toLowerCase().includes(needle) ||
      order.customer.toLowerCase().includes(needle) ||
      order.address.toLowerCase().includes(needle)
    );
  });
  const current = useMemo(() => orders.find((order) => order.id === selected?.id), [orders, selected]);
  const advance = (id: string) => {
    const currentOrder = orders.find((order) => order.id === id);
    if (currentOrder) void advanceOrder.mutateAsync({ id: currentOrder.id, status: currentOrder.status });
  };
  return (
    <QuickBiteShell>
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold uppercase text-primary">Order operations</p>
        <h1 className="mt-1 text-3xl font-extrabold">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {needle ? `Showing matches for “${q.trim()}”.` : "Incoming, current, and recent restaurant orders."}
        </p>
        <div className="mt-6 flex gap-2 overflow-x-auto">
          {statuses.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={filter === item ? "default" : "outline"}
              onClick={() => setFilter(item)}
              className="capitalize"
            >
              {item === "placed" ? "Incoming" : item}
            </Button>
          ))}
        </div>
        <ListShell
          loading={ordersQuery.isLoading}
          error={
            ordersQuery.isError
              ? ordersQuery.error instanceof Error
                ? ordersQuery.error.message
                : "Could not load orders."
              : null
          }
          onRetry={() => void ordersQuery.refetch()}
          empty={
            !ordersQuery.isLoading && !ordersQuery.isError && shown.length === 0
              ? {
                  title: orders.length === 0 ? "No orders yet" : "No orders match this filter",
                  body:
                    orders.length === 0
                      ? "Incoming orders will appear here when customers place them."
                      : "Try another status tab or clear your search.",
                }
              : null
          }>
          <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onOpen={() => setSelected(order)}
                onAdvance={() => advance(order.id)}
              />
            ))}
          </div>
        </ListShell>
        <OrderDrawer order={current} onClose={() => setSelected(undefined)} onAdvance={advance} />
      </div>
    </QuickBiteShell>
  );
}
