import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

import { throwApiError } from './errors';

export type ManagerInvite = Database['public']['Tables']['manager_invites']['Row'];
export type RestaurantMember = Database['public']['Tables']['restaurant_members']['Row'];

export async function acceptManagerInvites(): Promise<number> {
  const { data, error } = await supabase.rpc('accept_manager_invite');
  if (error) throwApiError(error, 'Could not accept invite.');
  return data ?? 0;
}

export async function inviteManager(restaurantId: string, email: string): Promise<ManagerInvite> {
  const { data, error } = await supabase.rpc('owner_invite_manager', {
    p_restaurant_id: restaurantId,
    p_email: email,
  });
  if (error || !data) throwApiError(error ?? {}, 'Could not send invite.');
  return data;
}

export async function revokeManager(restaurantId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('owner_revoke_manager', {
    p_restaurant_id: restaurantId,
    p_user_id: userId,
  });
  if (error) throwApiError(error, 'Could not remove manager.');
}

export async function createBranch(input: {
  name: string;
  address: string;
  branchName?: string;
  phone?: string;
  cuisine?: string;
  description?: string;
}) {
  const { data, error } = await supabase.rpc('owner_create_branch', {
    p_name: input.name,
    p_address: input.address,
    ...(input.branchName ? { p_branch_name: input.branchName } : {}),
    ...(input.phone ? { p_phone: input.phone } : {}),
    ...(input.cuisine ? { p_cuisine: input.cuisine } : {}),
    ...(input.description ? { p_description: input.description } : {}),
  });
  if (error || !data) throwApiError(error ?? {}, 'Could not create branch.');
  return data;
}

export async function listMembers(restaurantId: string) {
  const { data, error } = await supabase
    .from('restaurant_members')
    .select('user_id, status, created_at, profiles (full_name, email)')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active');
  if (error) throwApiError(error, 'Could not load managers.');
  return (data ?? []) as Array<{
    user_id: string;
    status: string;
    created_at: string;
    profiles: { full_name: string | null; email: string } | null;
  }>;
}

export async function listInvites(restaurantId: string) {
  const { data, error } = await supabase
    .from('manager_invites')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throwApiError(error, 'Could not load invites.');
  return data ?? [];
}
