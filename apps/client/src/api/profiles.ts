import type { Profile } from '@/types/models';

import { supabase } from './supabaseClient';
import { throwApiError } from './errors';

const PROFILE_COLUMNS =
  'id, full_name, email, role, phone, is_online, vehicle_label, plate, created_at, updated_at' as const;

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
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
    .select(PROFILE_COLUMNS)
    .single();
  if (error || !data) throwApiError(error ?? {}, 'Could not update profile.');
  const next = await getProfile(userId);
  return next ?? { ...data, roles: [data.role] };
}
