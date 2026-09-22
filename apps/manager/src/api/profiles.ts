import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

import { throwApiError } from './errors';

export type Profile = Database['public']['Tables']['profiles']['Row'] & {
  roles: Database['public']['Enums']['app_role'][];
};

export function hasRole(profile: Profile | null | undefined, role: Profile['role']) {
  return profile?.role === role;
}

export function isPartner(profile: Profile | null | undefined) {
  return hasRole(profile, 'restaurant_owner') || hasRole(profile, 'restaurant_manager');
}

export function isAdmin(profile: Profile | null | undefined) {
  return hasRole(profile, 'admin');
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throwApiError(error, 'Could not load profile.');
  if (!data) return null;
  return { ...data, roles: [data.role] };
}
