import type { Profile } from '@/types/models';

import { supabase } from './supabaseClient';
import { throwApiError } from './errors';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throwApiError(error, 'Could not load profile.');
  if (!data) return null;
  return { ...data, roles: [data.role] };
}

export async function updateProfile(
  userId: string,
  patch: { full_name?: string; phone?: string | null; is_online?: boolean },
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();
  if (error || !data) throwApiError(error ?? {}, 'Could not update profile.');
  const next = await getProfile(userId);
  return next ?? { ...data, roles: [data.role] };
}
