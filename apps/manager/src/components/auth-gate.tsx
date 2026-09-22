import { useEffect, type ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';

import { isAdmin, isPartner } from '@/api/profiles';
import { useAuth } from '@/hooks/use-auth';

const AUTH_PATHS = new Set(['/login', '/signup']);

function isAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
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
    if (admin) {
      if (!adminRoute) void navigate({ to: '/admin' });
      return;
    }
    if (partner) {
      if (isAuthRoute || isBlocked || adminRoute) void navigate({ to: '/' });
      return;
    }
    if (!isBlocked) void navigate({ to: '/blocked' });
  }, [admin, adminRoute, isAuthRoute, isBlocked, loading, navigate, partner, session]);

  if (loading) return null;
  if (!session) return isAuthRoute ? children : null;
  if (admin) return adminRoute ? children : null;
  if (partner) return isAuthRoute || isBlocked || adminRoute ? null : children;
  return isBlocked ? children : null;
}
