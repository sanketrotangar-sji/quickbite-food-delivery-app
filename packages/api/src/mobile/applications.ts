import type { Application } from '../models';
import type { Json } from '@quickbite/db';

import { db } from '../supabase';
import { throwApiError } from '../errors';

export async function listMyApplications(): Promise<Application[]> {
  const { data, error } = await db()
    .from('applications')
    .select('id, applicant_id, kind, status, payload, review_note, reviewed_by, reviewed_at, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) throwApiError(error, 'Could not load applications.');
  return data ?? [];
}

export async function submitApplication(
  kind: Application['kind'],
  payload: Record<string, string> = {},
): Promise<Application> {
  const { data, error } = await db().rpc('submit_application', {
    p_kind: kind,
    p_payload: payload as Json,
  });
  if (error || !data) throwApiError(error ?? {}, 'Could not submit application.');
  return data;
}

export async function acceptManagerInvites(): Promise<number> {
  const { data, error } = await db().rpc('accept_manager_invite');
  if (error) throwApiError(error, 'Could not accept invite.');
  return data ?? 0;
}

export async function listPendingInvites() {
  const { data, error } = await db()
    .from('manager_invites')
    .select('id, email, restaurant_id, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throwApiError(error, 'Could not load invites.');
  const rows = data ?? [];
  const ids = [...new Set(rows.map((row) => row.restaurant_id))];
  const kitchens = new Map<string, { name: string; branch_name: string | null }>();
  if (ids.length > 0) {
    const browse = await db().from('restaurant_browse').select('id, name, branch_name').in('id', ids);
    for (const row of browse.data ?? []) {
      if (row.id) kitchens.set(row.id, { name: row.name ?? 'Kitchen', branch_name: row.branch_name });
    }
  }
  return rows.map((row) => ({
    ...row,
    restaurants: kitchens.get(row.restaurant_id) ?? null,
  }));
}
