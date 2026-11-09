import { createFileRoute } from '@tanstack/react-router';

import { AdminOpsPage } from '@/features/admin/ops-page';

export const Route = createFileRoute('/admin/ops')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Ops — QuickBite' }],
  }),
  component: AdminOpsPage,
});
