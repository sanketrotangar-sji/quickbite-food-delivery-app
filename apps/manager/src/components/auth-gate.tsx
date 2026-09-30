import { useEffect, type ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';

import { isAdmin, isPartner } from '@/api/profiles';
import { useAuth } from '@/hooks/use-auth';

const AUTH_PATHS = new Set(['/login', '/signup']);

function isAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, profile, loading, profileError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAuthRoute = AUTH_PATHS.has(pathname);
  const isBlocked = pathname === '/blocked';
  const adminRoute = isAdminPath(pathname);
  const partner = isPartner(profile);
  const admin = isAdmin(profile);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      if (!isAuthRoute) void navigate({ to: '/login' });
      return;
    }
    // Network/profile failure — do not treat as "no access".
    if (profileError && !profile) return;
    if (admin) {
      if (!adminRoute) void navigate({ to: '/admin' });
      return;
    }
    if (partner) {
      if (isAuthRoute || isBlocked || adminRoute) void navigate({ to: '/' });
      return;
    }
    if (!isBlocked) void navigate({ to: '/blocked' });
  }, [admin, adminRoute, isAuthRoute, isBlocked, loading, navigate, partner, profile, profileError, session]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading QuickBite…
      </div>
    );
  }

  if (session && profileError && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-base font-medium text-foreground">Could not load your account</p>
        <p className="max-w-md text-sm text-muted-foreground">{profileError}</p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => void refreshProfile()}>
          Try again
        </button>
      </div>
    );
  }

  if (!session) return isAuthRoute ? children : null;
  if (admin) return adminRoute ? children : null;
  if (partner) return isAuthRoute || isBlocked || adminRoute ? null : children;
  return isBlocked ? children : null;
}
