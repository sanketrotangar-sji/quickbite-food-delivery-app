import { supabase } from '@/integrations/supabase/client';

export { supabaseConfigured } from '@/integrations/supabase/client';

// Email/password: https://supabase.com/docs/guides/auth/passwords
export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone?.trim() ?? '',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Google OAuth + PKCE: https://supabase.com/docs/guides/auth/social-login/auth-google
export async function signInWithGoogle() {
  const redirectTo = window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function exchangeCodeForSession(code: string) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}
