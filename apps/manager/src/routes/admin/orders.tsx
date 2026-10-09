import { createFileRoute } from '@tanstack/react-router';

import { AdminOrdersPage } from '@/features/admin/orders-page';

export const Route = createFileRoute('/admin/orders')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Admin orders — QuickBite' }],
  }),
  component: AdminOrdersPage,
});
