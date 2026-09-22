import { createFileRoute } from '@tanstack/react-router';

import { AdminRestaurantsPage } from '@/features/admin/restaurants-page';

export const Route = createFileRoute('/admin/restaurants')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Restaurants — QuickBite' }],
  }),
  component: AdminRestaurantsPage,
});
