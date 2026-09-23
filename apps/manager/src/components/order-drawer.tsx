import { Check, Circle, Clock3, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Order, OrderStatus } from "@/lib/quickbite-data";

const TIMELINE: { status: OrderStatus; label: string }[] = [
  { status: "placed", label: "Order placed" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready for pickup" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

const statusStep: Record<OrderStatus, number> = {
  placed: 0,
  preparing: 1,
  ready: 2,
  out_for_delivery: 3,
  delivered: 4,
  cancelled: 0,
};

const historyLabel: Partial<Record<OrderStatus, string>> = {
  placed: "Order placed",
  preparing: "Preparing",
  ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function money(value: number) {
  return Math.round(value);
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderDrawer({ order, onClose, onAdvance }: { order?: Order | undefined; onClose: () => void; onAdvance: (id: string) => void }) {
  const step = order ? statusStep[order.status] : 0;
  const subtotal = order ? order.items.reduce((sum, item) => sum + item.lineTotal, 0) : 0;
  const fee = order?.deliveryFee ?? 0;
  const canAdvance = order?.status === "placed" || order?.status === "preparing";
  const history = order?.history.filter((entry) => entry.status !== "cancelled") ?? [];
  const useHistory = history.length > 0;

  return (
    <Sheet open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card p-0 sm:max-w-lg">
        {order && (
          <>
            <SheetHeader className="border-b border-border p-6 pr-14">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-status px-2 py-1 text-[10px] font-extrabold uppercase text-status-foreground">
                  {order.status === "placed" ? "New order" : order.status.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-muted-foreground">{order.elapsed}</span>
              </div>
              <SheetTitle className="text-2xl">Order #{order.displayId}</SheetTitle>
              <SheetDescription>
                {order.customer} · {order.fulfillment}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-7 p-6">
              <section>
                <h3 className="mb-3 text-sm font-extrabold">Ordered items</h3>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.name} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3">
                      {item.image ? <img src={item.image} alt="" className="size-12 rounded-lg object-cover" /> : <span className="size-12 rounded-lg bg-secondary" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                      </div>
                      <span className="text-sm font-bold">₹{money(item.price)}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-xl bg-secondary p-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{money(subtotal)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                  <span>Delivery fee</span>
                  <span>₹{money(fee)}</span>
                </div>
                <div className="mt-3 flex justify-between border-t border-border pt-3 font-extrabold">
                  <span>Total</span>
                  <span>₹{money(order.total)}</span>
                </div>
              </section>
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
                  <MapPin className="size-4 text-primary" />
                  Delivery details
                </h3>
                <p className="text-sm text-muted-foreground">{order.address}</p>
              </section>
              <section>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-extrabold">
                  <Clock3 className="size-4 text-primary" />
                  Order timeline
                </h3>
                <div className="space-y-0">
                  {useHistory
                    ? history.map((entry, index) => {
                        const done = index < history.length - 1 || order.status === entry.status;
                        const current = index === history.length - 1;
                        return (
                          <div key={`${entry.status}-${entry.changedAt}`} className="grid grid-cols-[24px_1fr] gap-3">
                            <div className="flex flex-col items-center">
                              {done && !current ? (
                                <span className="grid size-5 place-items-center rounded-full bg-success text-success-foreground">
                                  <Check size={12} />
                                </span>
                              ) : current ? (
                                <span className="grid size-5 place-items-center rounded-full border-4 border-primary bg-card" />
                              ) : (
                                <Circle className="size-5 text-border" />
                              )}
                              {index < history.length - 1 && <span className="h-8 w-px bg-border" />}
                            </div>
                            <div className={current ? "pb-2" : "pb-2"}>
                              <p className={current ? "text-sm font-bold" : "text-sm text-muted-foreground"}>
                                {historyLabel[entry.status] ?? entry.status.replaceAll("_", " ")}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatWhen(entry.changedAt)}</p>
                            </div>
                          </div>
                        );
                      })
                    : TIMELINE.map((item, index) => (
                        <div key={item.status} className="grid grid-cols-[24px_1fr] gap-3">
                          <div className="flex flex-col items-center">
                            {index < step ? (
                              <span className="grid size-5 place-items-center rounded-full bg-success text-success-foreground">
                                <Check size={12} />
                              </span>
                            ) : index === step ? (
                              <span className="grid size-5 place-items-center rounded-full border-4 border-primary bg-card" />
                            ) : (
                              <Circle className="size-5 text-border" />
                            )}
                            {index < TIMELINE.length - 1 && <span className="h-8 w-px bg-border" />}
                          </div>
                          <p className={index === step ? "text-sm font-bold" : "text-sm text-muted-foreground"}>{item.label}</p>
                        </div>
                      ))}
                </div>
              </section>
            </div>
            <div className="sticky bottom-0 border-t border-border bg-card p-5">
              {canAdvance ? (
                <Button className="h-12 w-full" onClick={() => onAdvance(order.id)}>
                  {order.status === "placed" ? "Accept order" : "Mark ready for pickup"}
                </Button>
              ) : (
                <Button variant="outline" className="h-12 w-full">
                  View rider details
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
