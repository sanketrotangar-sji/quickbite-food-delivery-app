import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Menu as MenuIcon,
  MessageSquareText,
  Search,
  Store,
  TrendingUp,
  UserRound,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuickBiteLogo } from "@/components/quickbite-logo";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useManagerOrders } from "@/hooks/use-manager-orders";
import { useOwnedRestaurant, useUpdateRestaurant } from "@/hooks/use-restaurant";
import { servicePeriodLabel } from "@/lib/dashboard-stats";
import { cn } from "@/lib/utils";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${last}`.toUpperCase();
}

function groupRestaurants<T extends { name: string }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.name.trim() || "Restaurant";
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function formatSignedIn(value: string | undefined) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function QuickBiteShell({ children }: { children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => new Date());
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { profile, session, signOut } = useAuth();
  const { data: restaurant, restaurants, selectRestaurant } = useOwnedRestaurant();
  const orders = useManagerOrders().data ?? [];
  const updateRestaurant = useUpdateRestaurant();
  const liveCount = orders.filter(
    (order) =>
      order.status === "placed" || order.status === "preparing" || order.status === "ready",
  ).length;
  const displayName = profile?.full_name?.trim() || profile?.email || "Manager";
  const initials = initialsFromName(displayName);
  const isOwnerRole = profile?.role === "restaurant_owner";
  const roleLabel = isOwnerRole ? "Owner" : "Manager";
  const restaurantName = restaurant
    ? `${restaurant.name}${restaurant.branch_name ? ` · ${restaurant.branch_name}` : ""}`
    : "No restaurant assigned";
  const isOpen = restaurant?.is_open ?? false;
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const navItems = [
    { label: "Dashboard", to: "/" as const, icon: LayoutDashboard },
    { label: "Orders", to: "/orders" as const, icon: ClipboardList, count: liveCount },
    { label: "Menu", to: "/menu" as const, icon: UtensilsCrossed },
    { label: "Performance", to: "/performance" as const, icon: TrendingUp },
    ...(isOwnerRole
      ? [{ label: "Business", to: "/business" as const, icon: Building2 }]
      : []),
  ];

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const next = query.trim();
    if (!next) return;
    const looksLikeOrder = /^#?\d+$/.test(next);
    if (looksLikeOrder) {
      void navigate({ to: "/orders", search: { q: next.replace(/^#/, ""), status: "all" } });
    } else {
      void navigate({ to: "/menu", search: { q: next } });
    }
    setMobileNav(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mobileNav && (
        <button
          className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform md:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="relative flex h-24 items-center justify-center border-b border-sidebar-border px-4">
          <Link to="/" className="flex min-w-0 items-center justify-center" onClick={() => setMobileNav(false)}>
            <QuickBiteLogo />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 md:hidden"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>
        <nav className="flex-1 px-3 py-6">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Workspace
          </p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.to;
              const className = cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
                active
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/70",
              );
              const inner = (
                <>
                  <item.icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                  <span>{item.label}</span>
                  {"count" in item && (
                    <span className="ml-auto grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {item.count}
                    </span>
                  )}
                </>
              );
              if (item.to === "/orders") {
                return (
                  <Link
                    key={item.label}
                    to="/orders"
                    search={{ status: "all", q: "" }}
                    onClick={() => setMobileNav(false)}
                    className={className}
                  >
                    {inner}
                  </Link>
                );
              }
              if (item.to === "/menu") {
                return (
                  <Link
                    key={item.label}
                    to="/menu"
                    search={{ q: "" }}
                    onClick={() => setMobileNav(false)}
                    className={className}
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <Link key={item.label} to={item.to} onClick={() => setMobileNav(false)} className={className}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          {[
            { label: "Feedback", icon: MessageSquareText },
            { label: "Help", icon: CircleHelp },
          ].map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant="ghost"
              className="h-10 w-full justify-start gap-3 px-3 text-muted-foreground"
            >
              <Icon size={17} />
              {label}
            </Button>
          ))}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 w-full justify-start gap-3 px-3 text-muted-foreground"
              >
                <UserRound size={17} />
                Log out
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of QuickBite?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will leave this dashboard. Sign in again to manage the restaurant.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction onClick={() => void signOut()}>Log out</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="mt-3 rounded-lg bg-secondary p-3">
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-forest text-xs font-bold text-forest-foreground">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{displayName}</p>
                <p className="truncate text-xs font-semibold text-primary">{roleLabel}</p>
              </div>
            </div>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              {profile?.email || session?.user.email || "No email"}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              Logged in {formatSignedIn(session?.user.last_sign_in_at)}
            </p>
          </div>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6 lg:grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <MenuIcon />
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground">Now managing</p>
              {restaurants.length > 1 ? (
                <select
                  className="mt-1 max-w-full truncate rounded-md border border-border bg-card px-2 py-1 text-sm font-extrabold"
                  value={restaurant?.id ?? ""}
                  onChange={(event) => selectRestaurant(event.target.value)}
                >
                  {groupRestaurants(restaurants).map(([name, rows]) =>
                    rows.length > 1 ? (
                      <optgroup key={name} label={name}>
                        {rows.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.branch_name?.trim() || row.address}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      <option key={rows[0]?.id} value={rows[0]?.id}>
                        {rows[0]?.branch_name
                          ? `${rows[0].name} · ${rows[0].branch_name}`
                          : rows[0]?.name}
                      </option>
                    ),
                  )}
                </select>
              ) : (
                <button className="flex max-w-full items-center gap-1 text-left text-sm font-extrabold">
                  <Store className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{restaurantName}</span>
                  <ChevronDown className="size-3 shrink-0" />
                </button>
              )}
            </div>
          </div>
          <div className="hidden text-center lg:block">
            <p className="font-heading text-sm font-bold">{dateLabel}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {servicePeriodLabel(now)} · {timeLabel}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <form className="relative hidden lg:block" onSubmit={submitSearch}>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-56 bg-card pl-9"
                placeholder="Search orders or menu"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search orders or menu"
              />
            </form>
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:flex">
              <span
                className={cn("size-2 rounded-full", isOpen ? "bg-success" : "bg-muted-foreground")}
              />
              <span className="text-xs font-bold">{isOpen ? "Open" : "Closed"}</span>
              <Switch
                checked={isOpen}
                disabled={!restaurant}
                onCheckedChange={(next) => {
                  if (restaurant)
                    void updateRestaurant.mutateAsync({
                      id: restaurant.id,
                      patch: { is_open: next },
                    });
                }}
                aria-label="Restaurant open status"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="relative bg-card"
              aria-label="Notifications"
            >
              <Bell />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
            </Button>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
