import { createFileRoute } from '@tanstack/react-router';

import { AdminAiPage } from '@/features/admin/ai-page';

export const Route = createFileRoute('/admin/ai')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'AI — QuickBite' }],
  }),
  component: AdminAiPage,
});
