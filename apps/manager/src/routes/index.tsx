import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  Plus,
  ReceiptIndianRupee,
  Sparkles,
  TrendingUp,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { OrderCard } from "@/components/order-card";
import { OrderDrawer } from "@/components/order-drawer";
import { QuickBiteShell } from "@/components/quickbite-shell";
import { useAuth } from "@/hooks/use-auth";
import { useAdvanceOrder, useManagerOrders } from "@/hooks/use-manager-orders";
import { useManagerMenu, useToggleMenuAvailability } from "@/hooks/use-manager-menu";
import { useOwnedRestaurant, useRestaurantRatings } from "@/hooks/use-restaurant";
import {
  areaFromAddress,
  avgPrepLabel,
  compactRupee,
  formatRupee,
  greetingFor,
  hourlyPace,
  kitchenLoad,
  ordersOnDay,
  percentChangeLabel,
  revenueOf,
} from "@/lib/dashboard-stats";
import type { MenuItem, Order } from "@/lib/quickbite-data";

const WELCOME_STORAGE_KEY = "quickbite-welcome-date";
const EMPTY_ORDERS: Order[] = [];
const EMPTY_MENU: MenuItem[] = [];

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Restaurant Dashboard — QuickBite" },
      {
        name: "description",
        content:
          "Monitor live orders, restaurant performance, and menu availability with QuickBite.",
      },
      { property: "og:title", content: "Restaurant Dashboard — QuickBite" },
      {
        property: "og:description",
        content:
          "Monitor live orders, restaurant performance, and menu availability with QuickBite.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const { profile } = useAuth();
  const { data: restaurant } = useOwnedRestaurant();
  const { data: ratings } = useRestaurantRatings(restaurant?.id);
  const allOrders = useManagerOrders().data ?? EMPTY_ORDERS;
  const menuItems = useManagerMenu().data ?? EMPTY_MENU;
  const advanceOrder = useAdvanceOrder();
  const toggleAvailability = useToggleMenuAvailability();
  const [selected, setSelected] = useState<Order>();
  const [welcome, setWelcome] = useState(false);
  const orders = allOrders.filter(
    (order) =>
      order.status === "placed" || order.status === "preparing" || order.status === "ready",
  );
  const preparing = orders.filter((order) => order.status === "preparing").length;
  const placed = orders.filter((order) => order.status === "placed");
  const unavailable = menuItems.filter((item) => !item.available);
  const todayOrders = ordersOnDay(allOrders, now);
  const yesterdayOrders = ordersOnDay(allOrders, yesterday);
  const todayRevenue = revenueOf(todayOrders);
  const yesterdayRevenue = revenueOf(yesterdayOrders);
  const load = kitchenLoad(preparing);
  const prep = avgPrepLabel(allOrders, now);
  const pace = hourlyPace(allOrders, now);
  const selectedFresh = useMemo(
    () =>
      orders.find((order) => order.id === selected?.id) ??
      allOrders.find((order) => order.id === selected?.id),
    [allOrders, orders, selected],
  );
  const oldestPlaced = placed.reduce<Order | undefined>(
    (oldest, order) => (!oldest || order.placedAt < oldest.placedAt ? order : oldest),
    undefined,
  );
  const riderOrder = orders.find(
    (order) => order.riderId && (order.status === "ready" || order.status === "preparing"),
  );
  const attentionCount =
    (oldestPlaced ? 1 : 0) + (riderOrder ? 1 : 0) + (unavailable.length > 0 ? 1 : 0);
  const firstName = profile?.full_name?.trim() || profile?.email || "";

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = window.localStorage.getItem(WELCOME_STORAGE_KEY);
    if (lastShown !== today) {
      setWelcome(true);
      window.localStorage.setItem(WELCOME_STORAGE_KEY, today);
    }
  }, []);

  const advance = (id: string) => {
    const current = allOrders.find((order) => order.id === id);
    if (current) void advanceOrder.mutateAsync({ id: current.id, status: current.status });
  };

  const statCards = [
    {
      label: "Orders today",
      value: String(todayOrders.length),
      change: percentChangeLabel(todayOrders.length, yesterdayOrders.length),
      icon: PackageCheck,
    },
    {
      label: "Today’s revenue",
      value: formatRupee(todayRevenue),
      change: percentChangeLabel(todayRevenue, yesterdayRevenue),
      icon: ReceiptIndianRupee,
    },
    { label: "In preparation", value: String(preparing), change: load.label, icon: Clock3 },
    { label: "Average prep", value: prep.value, change: prep.change, icon: CircleDollarSign },
  ];
  const statuses = ["placed", "preparing", "ready"] as const;

  return (
    <QuickBiteShell>
      <div className="mx-auto max-w-[1500px]">
        <section aria-label="Today’s metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {statCards.map(({ label, value, change, icon: Icon }) => (
            <article key={label} className="min-w-0 rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <p className="truncate text-xs font-bold text-muted-foreground">{label}</p>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <Icon size={15} />
                </span>
              </div>
              <p className="font-heading mt-2 truncate text-xl font-extrabold sm:text-2xl">
                {value}
              </p>
              <p className="mt-1 truncate text-[11px] font-bold text-success">{change}</p>
            </article>
          ))}
        </section>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold">Live orders</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {orders.length} orders need the team’s attention
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/orders" search={{ status: "all", q: "" }}>
                  View all <ChevronRight />
                </Link>
              </Button>
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-3">
              {statuses.map((status) => {
                const laneOrders = orders.filter((order) => order.status === status);
                const featured = laneOrders[0];
                const listed = laneOrders.slice(1, 3);
                const hidden = Math.max(0, laneOrders.length - 3);
                return (
                  <div key={status} className="grid min-w-0 items-start gap-3">
                    {featured ? (
                      <OrderCard
                        order={featured}
                        onOpen={() => setSelected(featured)}
                        onAdvance={() => advance(featured.id)}
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                        No orders here
                      </div>
                    )}
                    {listed.map((order) => (
                      <div
                        key={order.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        <button type="button" onClick={() => setSelected(order)} className="min-w-0 text-left">
                          <span className="block truncate text-sm font-extrabold">#{order.displayId}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {areaFromAddress(order.address, order.customer)} · {order.elapsed}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-primary"
                          onClick={() =>
                            order.status === "placed" || order.status === "preparing"
                              ? advance(order.id)
                              : setSelected(order)
                          }
                        >
                          {order.status === "placed" ? "Accept" : order.status === "preparing" ? "Ready" : "View"}
                        </button>
                      </div>
                    ))}
                    {hidden > 0 ? (
                      <Button asChild variant="ghost" size="sm" className="justify-start px-1">
                        <Link to="/orders" search={{ status, q: "" }}>
                          Load more
                          <ChevronRight />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex flex-col gap-5">
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-extrabold">Quick actions</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="h-auto justify-between bg-card px-3 py-3">
                  <Link to="/menu" search={{ q: "" }}>
                    <span className="flex items-center gap-2">
                      <Plus />
                      Add item
                    </span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto justify-between bg-card px-3 py-3">
                  <Link to="/menu" search={{ q: "" }}>
                    <span className="flex items-center gap-2">
                      <Utensils />
                      Menu
                    </span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto justify-between bg-card px-3 py-3">
                  <Link to="/orders" search={{ status: "all", q: "" }}>
                    History
                  </Link>
                </Button>
                {profile?.role === "restaurant_owner" ? (
                  <Button asChild variant="outline" className="h-auto justify-between bg-card px-3 py-3">
                    <Link to="/business">Profile</Link>
                  </Button>
                ) : null}
              </div>
            </section>

          <aside className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-forest px-5 py-4 text-forest-foreground">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4" />
                <h2 className="text-sm font-extrabold">Needs attention</h2>
                <span className="ml-auto rounded-md bg-card/15 px-2 py-0.5 text-[10px] font-extrabold">
                  {attentionCount}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-forest-foreground/70">
                Priority checks for this service
              </p>
            </div>
            <div className="divide-y divide-border px-5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4">
                <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
                  <Clock3 size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">
                    {oldestPlaced ? "New order waiting" : "No new orders"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {oldestPlaced
                      ? `${areaFromAddress(oldestPlaced.address, `#${oldestPlaced.displayId}`)} · ${oldestPlaced.elapsed}`
                      : "Queue is clear"}
                  </p>
                </div>
                {oldestPlaced ? (
                  <Button size="sm" onClick={() => advance(oldestPlaced.id)}>
                    Accept
                  </Button>
                ) : null}
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4">
                <span className="grid size-8 place-items-center rounded-lg bg-success-soft text-success">
                  <Bike size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">
                    {riderOrder ? "Rider approaching" : "No rider assigned"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {riderOrder
                      ? `${areaFromAddress(riderOrder.address, `#${riderOrder.displayId}`)} · ${riderOrder.elapsed}`
                      : "Waiting on kitchen"}
                  </p>
                </div>
                <span
                  className={
                    riderOrder
                      ? "text-xs font-bold text-success"
                      : "text-xs font-bold text-muted-foreground"
                  }
                >
                  {riderOrder ? "On time" : "Pending"}
                </span>
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4">
                <span className="grid size-8 place-items-center rounded-lg bg-warning-soft text-warning-foreground">
                  <Utensils size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">{unavailable.length} unavailable items</p>
                  <p className="truncate text-xs text-muted-foreground">Could affect peak demand</p>
                </div>
                <Button asChild variant="ghost" size="icon">
                  <Link to="/menu" search={{ q: "" }} aria-label="Review unavailable items">
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="border-t border-border bg-secondary px-5 py-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold">Kitchen capacity</span>
                <span className="font-extrabold text-success">
                  {load.percent}% · {load.label}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div className={`h-full rounded-full bg-success ${load.bar}`} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Estimated preparation: {prep.value}
              </p>
            </div>
          </aside>
          </div>
        </div>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <h2 className="font-extrabold">Unavailable items</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {unavailable.length} of {menuItems.length} menu items paused
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/menu" search={{ q: "" }}>Manage menu</Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {unavailable.length ? (
                unavailable.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="size-12 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="size-12 rounded-lg bg-secondary" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.category} · ₹{item.price}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void toggleAvailability.mutateAsync({ id: item.id, available: true })
                      }
                    >
                      <CheckCircle2 />
                      Restore
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Every menu item is available.</p>
              )}
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold">Today’s pace</h2>
                <p className="mt-1 text-xs text-muted-foreground">Orders by service hour</p>
              </div>
              <TrendingUp className="size-5 text-success" />
            </div>
            <ChartContainer
              config={{ orders: { label: "Orders", color: "var(--primary)" } }}
              className="mt-4 aspect-[2.4/1] w-full"
            >
              <BarChart data={pace} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={3} tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} width={24} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-orders)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <p className="mt-2 text-[10px] font-semibold text-muted-foreground">8 AM through 11 PM</p>
          </section>
        </div>

        {welcome && (
          <aside className="fixed left-4 right-4 top-24 z-40 overflow-hidden rounded-xl border border-border bg-card shadow-card-hover sm:left-auto sm:right-6 sm:w-[370px]">
            <div className="h-1 bg-success" />
            <div className="p-5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWelcome(false)}
                className="absolute right-3 top-3"
                aria-label="Dismiss welcome"
              >
                <X />
              </Button>
              <span className="grid size-9 place-items-center rounded-lg bg-success-soft text-success">
                <Sparkles size={18} />
              </span>
              <p className="font-heading mt-4 text-base font-extrabold">
                {greetingFor(now, firstName)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The kitchen is ready for a smooth service.
              </p>
              <div className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border py-3 text-center">
                <div>
                  <strong className="block text-sm">{yesterdayOrders.length}</strong>
                  <span className="text-[10px] text-muted-foreground">Orders</span>
                </div>
                <div>
                  <strong className="block text-sm">{compactRupee(yesterdayRevenue)}</strong>
                  <span className="text-[10px] text-muted-foreground">Revenue</span>
                </div>
                <div>
                  <strong className="block text-sm">
                    {ratings && ratings.count > 0 ? ratings.average.toFixed(1) : "—"}
                  </strong>
                  <span className="text-[10px] text-muted-foreground">Rating</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Yesterday finished strongly. Wishing you and the team a great day.
              </p>
            </div>
          </aside>
        )}
        <OrderDrawer
          order={selectedFresh}
          onClose={() => setSelected(undefined)}
          onAdvance={advance}
        />
      </div>
    </QuickBiteShell>
  );
}
