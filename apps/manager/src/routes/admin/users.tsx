import { createFileRoute } from '@tanstack/react-router';

import { AdminUsersPage } from '@/features/admin/users-page';

export const Route = createFileRoute('/admin/users')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Users — QuickBite' }],
  }),
  component: AdminUsersPage,
});
