import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { listPerformanceOrders } from "@/api/orders";
import { listRatingSummaries } from "@/api/restaurants";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { QuickBiteShell } from "@/components/quickbite-shell";
import { useAuth } from "@/hooks/use-auth";
import { useOwnedRestaurant } from "@/hooks/use-restaurant";
import {
  aovOf,
  dailySeries,
  formatRupee,
  ordersInRange,
  percentChangeLabel,
  prepMinutesFromHistory,
  prepSlaSummary,
  rangeWindow,
  revenueOf,
  type PerformanceRange,
} from "@/lib/dashboard-stats";
import { cn } from "@/lib/utils";

const RANGES: { id: PerformanceRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
];

export const Route = createFileRoute("/performance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Performance — QuickBite" },
      { name: "description", content: "Restaurant performance for owners and managers." },
      { property: "og:title", content: "Performance — QuickBite" },
      { property: "og:description", content: "Restaurant performance for owners and managers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerformancePage,
});

function PerformancePage() {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const { restaurants, isLoading, selectRestaurant } = useOwnedRestaurant();
  const [range, setRange] = useState<PerformanceRange>("today");
  const isOwner = profile?.role === "restaurant_owner";
  const visible = isOwner
    ? restaurants.filter((row) => row.owner_id === session?.user.id)
    : restaurants;
  const ids = visible.map((row) => row.id);
  const idKey = ids.slice().sort().join(",");
  const now = new Date();
  const window = rangeWindow(range, now);
  const priorLabel = range === "today" ? "yesterday" : `prior ${window.days}d`;

  const orders = useQuery({
    queryKey: ["performance-orders", idKey],
    queryFn: () => listPerformanceOrders(ids),
    enabled: ids.length > 0,
  });
  const ratings = useQuery({
    queryKey: ["performance-ratings", idKey],
    queryFn: () => listRatingSummaries(ids),
    enabled: ids.length > 0,
  });

  const rows = useMemo(
    () =>
      (orders.data ?? []).map((row) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        status: row.status,
        total: Number(row.total_amount),
        placedAt: row.placed_at,
        history: [...(row.order_status_history ?? [])]
          .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
          .map((entry) => ({ status: entry.status, changedAt: entry.changed_at })),
      })),
    [orders.data],
  );

  const currentAll = ordersInRange(rows, window.start, window.end);
  const priorAll = ordersInRange(rows, window.priorStart, window.priorEnd);
  const series = dailySeries(currentAll, window.start, window.days);
  const rollupPrep = prepSlaSummary(
    currentAll
      .map((order) => prepMinutesFromHistory(order.placedAt, order.history))
      .filter((value): value is number => value != null),
    30,
  );
  const error = orders.error ?? ratings.error;

  return (
    <QuickBiteShell>
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase text-primary">Performance</p>
        <h1 className="mt-1 text-3xl font-extrabold">
          {isOwner ? "All restaurants" : "Assigned restaurants"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Orders, revenue, AOV, and prep SLA. Open a card to run that kitchen.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {RANGES.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={range === item.id ? "default" : "outline"}
              onClick={() => setRange(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {error ? (
          <p className="mt-4 text-sm font-semibold text-destructive">{(error as Error).message}</p>
        ) : null}

        {visible.length > 0 ? (
          <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label="Orders"
              value={String(currentAll.length)}
              hint={percentChangeLabel(currentAll.length, priorAll.length, priorLabel)}
            />
            <Stat
              label="Revenue"
              value={formatRupee(revenueOf(currentAll))}
              hint={percentChangeLabel(revenueOf(currentAll), revenueOf(priorAll), priorLabel)}
            />
            <Stat
              label="AOV"
              value={currentAll.length ? formatRupee(aovOf(currentAll)) : "—"}
              hint={
                priorAll.length
                  ? percentChangeLabel(aovOf(currentAll), aovOf(priorAll), priorLabel)
                  : "Average order value"
              }
            />
            <Stat label="Avg prep (to ready)" value={rollupPrep.avgLabel} hint={rollupPrep.slaLabel} />
          </section>
        ) : null}

        {visible.length > 0 && window.days > 1 ? (
          <section className="mt-5 rounded-xl border border-border bg-card p-5">
            <h2 className="font-extrabold">Daily trend</h2>
            <p className="mt-1 text-xs text-muted-foreground">Orders in the selected range</p>
            <ChartContainer
              config={{ orders: { label: "Orders", color: "var(--primary)" } }}
              className="mt-4 aspect-[2.6/1] w-full"
            >
              <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} width={24} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="var(--color-orders)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </section>
        ) : null}

        {isLoading || (ids.length > 0 && orders.isLoading && !orders.data) ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading restaurants and orders…</p>
        ) : visible.length === 0 ? (
          <div className="mt-7 rounded-xl border border-border bg-card p-10 text-center">
            <p className="font-bold">No restaurants assigned</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOwner
                ? "Add a restaurant from Business to see performance here."
                : "An owner has to invite you before this summary appears."}
            </p>
          </div>
        ) : orders.isError ? (
          <p className="mt-6 text-sm font-semibold text-destructive">
            {(orders.error as Error).message}
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {visible.map((restaurant) => {
              const mine = rows.filter((row) => row.restaurantId === restaurant.id);
              const current = ordersInRange(mine, window.start, window.end);
              const prior = ordersInRange(mine, window.priorStart, window.priorEnd);
              const target = restaurant.prep_minutes ?? 30;
              const prep = prepSlaSummary(
                current
                  .map((order) => prepMinutesFromHistory(order.placedAt, order.history))
                  .filter((value): value is number => value != null),
                target,
              );
              const rating = ratings.data?.[restaurant.id];
              const ratingText =
                rating && rating.count > 0
                  ? `${rating.average.toFixed(1)} · ${rating.count} review${rating.count === 1 ? "" : "s"}`
                  : "No ratings yet";
              return (
                <li key={restaurant.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
                    onClick={() => {
                      selectRestaurant(restaurant.id);
                      void navigate({ to: "/" });
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-extrabold">
                          {restaurant.name}
                          {restaurant.branch_name ? ` · ${restaurant.branch_name}` : ""}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{restaurant.address}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-bold",
                          restaurant.is_open ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {restaurant.is_open ? "Open" : "Closed"}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Metric label="Orders" value={String(current.length)} />
                      <Metric label="Revenue" value={formatRupee(revenueOf(current))} />
                      <Metric label="AOV" value={current.length ? formatRupee(aovOf(current)) : "—"} />
                      <Metric label="Rating" value={ratingText} icon />
                    </dl>
                    <p className="mt-3 text-[11px] font-bold text-success">
                      Prep {prep.avgLabel} · {prep.slaLabel}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                      {percentChangeLabel(revenueOf(current), revenueOf(prior), priorLabel)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </QuickBiteShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="font-heading mt-2 text-2xl font-extrabold">{value}</p>
      <p className="mt-1 truncate text-[11px] font-bold text-success">{hint}</p>
    </article>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-center gap-1 truncate text-sm font-extrabold">
        {icon ? <Star className="size-3 shrink-0 text-primary" /> : null}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
