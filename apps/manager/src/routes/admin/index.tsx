import { createFileRoute } from '@tanstack/react-router';

import { AdminDashboardPage } from '@/features/admin/dashboard-page';

export const Route = createFileRoute('/admin/')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Platform dashboard — QuickBite' }],
  }),
  component: AdminDashboardPage,
});
