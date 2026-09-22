import { createFileRoute } from '@tanstack/react-router';

import { AdminApplicationsPage } from '@/features/admin/applications-page';

export const Route = createFileRoute('/admin/applications')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Applications — QuickBite' }],
  }),
  component: AdminApplicationsPage,
});
