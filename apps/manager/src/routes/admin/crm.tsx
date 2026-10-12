import { createFileRoute } from '@tanstack/react-router';

import { AdminCrmPage } from '@/features/admin/crm-page';

export const Route = createFileRoute('/admin/crm')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'CRM Campaigns — QuickBite' }],
  }),
  component: AdminCrmPage,
});
