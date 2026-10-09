import { createFileRoute } from '@tanstack/react-router';

import { AdminTicketsPage } from '@/features/admin/tickets-page';

export const Route = createFileRoute('/admin/tickets')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Tickets — QuickBite' }],
  }),
  component: AdminTicketsPage,
});
