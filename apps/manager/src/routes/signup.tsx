import { createFileRoute, Link } from '@tanstack/react-router';

import { AuthFrame } from '@/components/auth-frame';

export const Route = createFileRoute('/signup')({
  head: () => ({
    meta: [{ title: 'Become a partner — QuickBite' }],
  }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthFrame>
      <h1 className="font-heading text-center text-2xl font-extrabold">Partner access is by approval</h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Create a customer account in the QuickBite app, then apply under Settings → Careers. Once your
        restaurant is approved, sign in here with the same email or Google account. Branch managers are
        invited by the restaurant owner.
      </p>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already approved?{' '}
        <Link to="/login" className="font-bold text-primary">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
