import { supabase } from './supabaseClient';
import { throwApiError } from './errors';

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
    const { data } = await supabase.auth.getSession();
    uid = data.session?.user.id;
  }
  if (!uid) throwApiError({}, 'Not signed in.');

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, created_at, read_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
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
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
  if (error) throwApiError(error, 'Could not update the notification.');
}
