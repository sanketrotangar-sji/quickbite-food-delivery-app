import { createFileRoute, Link } from '@tanstack/react-router';
import { UtensilsCrossed } from 'lucide-react';

export const Route = createFileRoute('/signup')({
  head: () => ({
    meta: [{ title: 'Become a partner — QuickBite' }],
  }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <UtensilsCrossed size={18} />
          </span>
          <div>
            <strong className="block text-base font-extrabold">QUICKBITE</strong>
            <span className="block text-[11px] font-semibold text-muted-foreground">Restaurant Partner</span>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold">Partner access is by approval</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Create a customer account in the QuickBite app, then apply under Settings → Careers. After an admin
          approves, sign in here with the same email or Google account. Branch managers are invited by the
          restaurant owner.
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already approved?{' '}
          <Link to="/login" className="font-bold text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
