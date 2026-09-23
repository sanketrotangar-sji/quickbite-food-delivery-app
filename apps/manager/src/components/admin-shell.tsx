import { Link, useRouterState } from '@tanstack/react-router';
import { Building2, ClipboardList, LayoutDashboard, LogOut, Menu, Sparkles, Users, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { QuickBiteLogo } from '@/components/quickbite-logo';
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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/applications', label: 'Applications', icon: ClipboardList, exact: false },
  { to: '/admin/restaurants', label: 'Restaurants', icon: Building2, exact: false },
  { to: '/admin/users', label: 'Users', icon: Users, exact: false },
  { to: '/admin/highlights', label: 'Offers', icon: Sparkles, exact: false },
] as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return `${first}${last}`.toUpperCase();
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { profile, session, signOut } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const displayName = profile?.full_name?.trim() || profile?.email || 'Admin';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const signedIn = session?.user.last_sign_in_at
    ? new Date(session.user.last_sign_in_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Just now';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {open ? (
        <button
          className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="relative flex h-24 items-center justify-center border-b border-sidebar-border px-4">
          <Link to="/admin" onClick={() => setOpen(false)}>
            <QuickBiteLogo />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Platform</p>
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold',
                  active ? 'bg-sidebar-accent text-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="h-10 w-full justify-start gap-3 px-3 text-muted-foreground">
                <LogOut size={17} />
                Log out
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of QuickBite?</AlertDialogTitle>
                <AlertDialogDescription>You will leave the admin dashboard.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction onClick={() => void signOut()}>Log out</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="mt-3 rounded-lg bg-secondary p-3">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-forest text-xs font-bold text-forest-foreground">
                {initials(displayName)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{displayName}</p>
                <p className="text-xs font-semibold text-primary">Admin</p>
              </div>
            </div>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">{profile?.email || session?.user.email}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Logged in {signedIn}</p>
          </div>
        </div>
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
              <Menu />
            </Button>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Now managing</p>
              <p className="text-sm font-extrabold">QuickBite platform</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-heading text-sm font-bold">{dateLabel}</p>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">{timeLabel}</p>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
