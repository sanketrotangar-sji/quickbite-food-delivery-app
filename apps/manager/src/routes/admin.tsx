import { Outlet, createFileRoute } from '@tanstack/react-router';

import { AdminShell } from '@/components/admin-shell';

export const Route = createFileRoute('/admin')({
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
