import { createFileRoute } from '@tanstack/react-router';

import { AdminHighlightsPage } from '@/features/admin/highlights-page';

export const Route = createFileRoute('/admin/highlights')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Highlights — QuickBite' }],
  }),
  component: AdminHighlightsPage,
});
