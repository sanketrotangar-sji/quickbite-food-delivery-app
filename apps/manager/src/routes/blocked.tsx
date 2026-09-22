import { createFileRoute } from '@tanstack/react-router';
import { UtensilsCrossed } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/blocked')({
  head: () => ({
    meta: [{ title: 'Partner access — QuickBite' }],
  }),
  component: BlockedPage,
});

function BlockedPage() {
  const { profile, signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card">
        <span className="mx-auto mb-4 grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <UtensilsCrossed size={18} />
        </span>
        <h1 className="text-2xl font-extrabold">This dashboard is for restaurant partners</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {profile?.email ? `${profile.email} is signed in.` : 'This account is signed in.'} Apply to open a
          restaurant in the QuickBite app, or ask the owner to invite this email as a branch manager.
        </p>
        <Button className="mt-6 h-11 w-full" onClick={() => void signOut()}>
          Log out
        </Button>
      </div>
    </div>
  );
}
