import { ArrowRight, Bike, Clock3, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { areaFromAddress } from "@/lib/dashboard-stats";
import type { Order } from "@/lib/quickbite-data";
import { cn } from "@/lib/utils";

export function OrderCard({
  order,
  onOpen,
  onAdvance,
}: {
  order: Order;
  onOpen: () => void;
  onAdvance: () => void;
}) {
  const labels: Record<string, string> = {
    placed: "New order",
    preparing: "Preparing",
    ready: "Ready for pickup",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  const canAdvance = order.status === "placed" || order.status === "preparing";
  const area = areaFromAddress(order.address, `#${order.displayId}`);
  return (
    <article className="h-fit min-w-0 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <button className="block w-full text-left" onClick={onOpen}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-extrabold uppercase",
                  order.status === "placed"
                    ? "bg-primary-soft text-primary"
                    : order.status === "preparing"
                      ? "bg-warning-soft text-warning-foreground"
                      : "bg-success-soft text-success",
                )}
              >
                {labels[order.status] ?? order.status}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 size={13} />
                {order.elapsed}
              </span>
            </div>
            <h3 className="mt-3 flex items-center gap-1.5 truncate text-lg font-extrabold">
              <MapPin className="size-4 shrink-0 text-primary" />
              {area}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              #{order.displayId} · {order.customer}
            </p>
          </div>
          <div className="flex -space-x-2">
            {order.items.slice(0, 2).map((item) =>
              item.image ? (
                <img
                  key={item.name}
                  src={item.image}
                  alt=""
                  className="size-11 rounded-full border-2 border-card object-cover"
                />
              ) : null,
            )}
          </div>
        </div>
        <div className="my-4 space-y-1.5 border-y border-border py-3">
          {order.items.map((item) => (
            <div key={item.name} className="flex justify-between gap-3 text-sm">
              <span className="truncate">
                <strong>{item.quantity}×</strong> {item.name}
              </span>
              <span className="font-semibold">₹{item.price}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bike size={14} />
          <span className="truncate">{order.fulfillment}</span>
        </div>
      </button>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <strong className="text-lg">₹{order.total}</strong>
        {canAdvance ? (
          <Button onClick={onAdvance} className="min-w-32">
            {order.status === "placed" ? "Accept order" : "Mark ready"}
            <ArrowRight />
          </Button>
        ) : (
          <Button variant="outline" onClick={onOpen}>
            View order
          </Button>
        )}
      </div>
    </article>
  );
}
