import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { listPerformanceOrders } from "@/api/orders";
import { listRatingSummaries } from "@/api/restaurants";
import { QuickBiteShell } from "@/components/quickbite-shell";
import { useAuth } from "@/hooks/use-auth";
import { useOwnedRestaurant } from "@/hooks/use-restaurant";
import { formatRupee, ordersOnDay, percentChangeLabel, revenueOf } from "@/lib/dashboard-stats";

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
  const isOwner = profile?.role === "restaurant_owner";
  const visible = isOwner
    ? restaurants.filter((row) => row.owner_id === session?.user.id)
    : restaurants;
  const ids = visible.map((row) => row.id);
  const idKey = ids.slice().sort().join(",");
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

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

  const rows = (orders.data ?? []).map((row) => ({
    restaurantId: row.restaurant_id,
    status: row.status,
    total: Number(row.total_amount),
    placedAt: row.placed_at,
  }));
  const todayAll = ordersOnDay(rows, now);
  const yesterdayAll = ordersOnDay(rows, yesterday);
  const error = orders.error ?? ratings.error;

  return (
    <QuickBiteShell>
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase text-primary">Performance</p>
        <h1 className="mt-1 text-3xl font-extrabold">
          {isOwner ? "All restaurants" : "Assigned restaurants"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Today’s orders, revenue, and rating. Open a card to run that kitchen.
        </p>

        {error ? (
          <p className="mt-4 text-sm font-semibold text-destructive">{(error as Error).message}</p>
        ) : null}

        {isOwner && visible.length > 0 ? (
          <section className="mt-6 grid grid-cols-2 gap-3">
            <Stat
              label="Orders today"
              value={String(todayAll.length)}
              hint={percentChangeLabel(todayAll.length, yesterdayAll.length)}
            />
            <Stat
              label="Revenue today"
              value={formatRupee(revenueOf(todayAll))}
              hint={percentChangeLabel(revenueOf(todayAll), revenueOf(yesterdayAll))}
            />
          </section>
        ) : null}

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading restaurants…</p>
        ) : visible.length === 0 ? (
          <div className="mt-7 rounded-xl border border-border bg-card p-10 text-center">
            <p className="font-bold">No restaurants assigned</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOwner
                ? "Add a restaurant from Business to see performance here."
                : "An owner has to invite you before this summary appears."}
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {visible.map((restaurant) => {
              const mine = rows.filter((row) => row.restaurantId === restaurant.id);
              const today = ordersOnDay(mine, now);
              const prior = ordersOnDay(mine, yesterday);
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
                        className={
                          restaurant.is_open
                            ? "shrink-0 text-xs font-bold text-success"
                            : "shrink-0 text-xs font-bold text-muted-foreground"
                        }
                      >
                        {restaurant.is_open ? "Open" : "Closed"}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2">
                      <Metric label="Orders" value={String(today.length)} />
                      <Metric label="Revenue" value={formatRupee(revenueOf(today))} />
                      <Metric label="Rating" value={ratingText} icon />
                    </dl>
                    <p className="mt-3 text-[11px] font-bold text-success">
                      {percentChangeLabel(revenueOf(today), revenueOf(prior))}
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
