import type { Json } from '@quickbite/db';
import { db } from '../supabase';
import { throwApiError } from '../errors';

export type RiderNotice = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export async function listMyNotifications(userId?: string): Promise<RiderNotice[]> {
  let uid = userId;
  if (!uid) {
    const { data } = await db().auth.getSession();
    uid = data.session?.user.id;
  }
  if (!uid) throwApiError({}, 'Not signed in.');

  const { data, error } = await db()
    .from('notifications')
    .select('id, title, body, created_at, read_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throwApiError(error, 'Could not load notifications.');
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

export async function markNotificationRead(id: string) {
  const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
  if (error) throwApiError(error, 'Could not update the notification.');
}

export async function registerPushDeviceToken(input: {
  token: string;
  platform: 'ios' | 'android';
  metadata: Json;
}) {
  const { error } = await db().rpc('register_push_device', {
    p_token: input.token,
    p_platform: input.platform,
    p_metadata: input.metadata,
  });
  if (error) throwApiError(error, 'Could not register push device.');
}

export async function hasEnabledPushDeviceToken(): Promise<boolean> {
  const { data, error } = await db()
    .from('push_device_tokens')
    .select('enabled')
    .eq('enabled', true)
    .limit(1);
  if (error) throwApiError(error, 'Could not check push notification status.');
  return (data?.length ?? 0) > 0;
}

export async function disableUserPushTokens(): Promise<boolean> {
  const { data } = await db().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return false;
  const { error } = await db()
    .from('push_device_tokens')
    .update({ enabled: false })
    .eq('user_id', userId);
  if (error) throwApiError(error, 'Could not disable push notifications.');
  return false;
}
