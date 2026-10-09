import { createFileRoute } from '@tanstack/react-router';

import { AdminRidersPage } from '@/features/admin/riders-page';

export const Route = createFileRoute('/admin/riders')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Riders — QuickBite' }],
  }),
  component: AdminRidersPage,
});
