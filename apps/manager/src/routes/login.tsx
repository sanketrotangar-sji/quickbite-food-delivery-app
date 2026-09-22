import { createFileRoute, Link } from '@tanstack/react-router';
import { UtensilsCrossed } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { signInWithEmail, signInWithGoogle, supabaseConfigured } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [{ title: 'Sign in — QuickBite Manager' }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabaseConfigured) {
      setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) to the manager env.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    if (!supabaseConfigured) {
      setError('Supabase env is missing.');
      return;
    }
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setGoogleLoading(false);
    }
  }

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
        <h1 className="text-2xl font-extrabold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Email and password, or Google.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
          <Button className="h-11 w-full" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <Button className="mt-3 h-11 w-full" type="button" variant="outline" onClick={() => void onGoogle()} disabled={googleLoading}>
          {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
        </Button>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New restaurant? Apply in the QuickBite app, then{' '}
          <Link to="/signup" className="font-bold text-primary">
            read how access works
          </Link>
        </p>
      </div>
    </div>
  );
}
