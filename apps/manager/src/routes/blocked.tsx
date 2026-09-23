import { createFileRoute } from '@tanstack/react-router';

import { AuthFrame } from '@/components/auth-frame';
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
    <AuthFrame>
      <div className="text-center">
        <h1 className="font-heading text-2xl font-extrabold">No restaurant access yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {profile?.email ? `${profile.email} is signed in.` : 'This account is signed in.'} Apply to open a
          restaurant in the QuickBite app, or ask the owner to invite this email as a branch manager.
        </p>
        <Button className="mt-6 h-11 w-full" onClick={() => void signOut()}>
          Log out
        </Button>
      </div>
    </AuthFrame>
  );
}
