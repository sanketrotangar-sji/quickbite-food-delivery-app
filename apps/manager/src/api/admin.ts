import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type ApplicationKind = Database['public']['Enums']['application_kind'];
type ApplicationStatus = Database['public']['Enums']['application_status'];
type HighlightKind = Database['public']['Tables']['home_highlights']['Row']['kind'];

export type AdminApplication = {
  id: string;
  kind: ApplicationKind;
  status: ApplicationStatus;
  payload: Record<string, unknown>;
  review_note: string | null;
  applicant_id: string;
  email: string | null;
  full_name: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
};

export type AdminRestaurant = {
  id: string;
  name: string;
  branch_name: string | null;
  cuisine: string | null;
  address: string;
  is_open: boolean;
  owner_id: string;
  owner: string;
  managers: string[];
};

export type AdminHighlight = Database['public']['Tables']['home_highlights']['Row'];

export type HighlightInput = {
  title: string;
  subtitle: string | null;
  image_url: string;
  kind: HighlightKind;
  sort_order: number;
  is_active: boolean;
  restaurant_id: string | null;
  badge: string | null;
  cta_label: string | null;
};

export type AdminSummary = {
  restaurants: number;
  owners: number;
  openRestaurants: number;
  pendingApps: number;
  people: number;
  roleHint: string;
  liveOrders: number | undefined;
  recent: {
    id: string;
    status: string;
    total_amount: number;
    delivery_address: string;
  }[];
};

export async function loadAdminSummary(): Promise<AdminSummary> {
  const [restaurants, applications, roles, live, orders] = await Promise.all([
    supabase.from('restaurants').select('id, is_open, owner_id'),
    supabase.from('applications').select('id, status'),
    supabase.from('profiles').select('role'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['placed', 'preparing', 'ready']),
    supabase
      .from('orders')
      .select('id, status, total_amount, delivery_address, placed_at')
      .order('placed_at', { ascending: false })
      .limit(8),
  ]);
  const firstError = restaurants.error ?? applications.error ?? roles.error;
  if (firstError) throw new Error(firstError.message);

  const restaurantRows = restaurants.data ?? [];
  const roleRows = roles.data ?? [];
  const counts = new Map<string, number>();
  for (const row of roleRows) counts.set(row.role, (counts.get(row.role) ?? 0) + 1);
  const roleHint = ['customer', 'restaurant_owner', 'restaurant_manager', 'rider', 'admin']
    .filter((role) => counts.has(role))
    .map((role) => `${counts.get(role)} ${role.replace('restaurant_', '')}`)
    .join(' · ');

  return {
    restaurants: restaurantRows.length,
    owners: new Set(restaurantRows.map((row) => row.owner_id)).size,
    openRestaurants: restaurantRows.filter((row) => row.is_open).length,
    pendingApps: (applications.data ?? []).filter((row) => row.status === 'pending').length,
    people: roleRows.length,
    roleHint: roleHint || 'No roles yet',
    liveOrders: live.error ? undefined : (live.count ?? 0),
    recent: orders.error ? [] : (orders.data ?? []),
  };
}

export async function loadAdminApplications(): Promise<AdminApplication[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('id, kind, status, payload, review_note, applicant_id, profiles:applicant_id (email, full_name)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const profile = normalizeProfile(row.profiles);
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      payload: asRecord(row.payload),
      review_note: row.review_note,
      applicant_id: row.applicant_id,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
    };
  });
}

export async function reviewApplication(id: string, approve: boolean, note: string) {
  const { error } = await supabase.rpc('admin_review_application', {
    p_application_id: id,
    p_approve: approve,
    ...(note ? { p_note: note } : {}),
  });
  if (error) throw new Error(error.message);
}

export async function loadAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role')
    .order('email');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadAdminRestaurants(): Promise<AdminRestaurant[]> {
  const [restaurants, profiles, members] = await Promise.all([
    supabase.from('restaurants').select('id, name, branch_name, cuisine, address, is_open, owner_id').order('name'),
    supabase.from('profiles').select('id, email, full_name'),
    supabase.from('restaurant_members').select('restaurant_id, user_id, status').eq('status', 'active'),
  ]);
  const firstError = restaurants.error ?? profiles.error ?? members.error;
  if (firstError) throw new Error(firstError.message);

  const byId = new Map(
    (profiles.data ?? []).map((row) => [
      row.id,
      { name: row.full_name?.trim() || row.email, email: row.email },
    ]),
  );
  const managersByRestaurant = new Map<string, string[]>();
  for (const member of members.data ?? []) {
    const email = byId.get(member.user_id)?.email ?? 'Unknown manager';
    const list = managersByRestaurant.get(member.restaurant_id) ?? [];
    list.push(email);
    managersByRestaurant.set(member.restaurant_id, list);
  }

  return (restaurants.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    branch_name: row.branch_name,
    cuisine: row.cuisine,
    address: row.address,
    is_open: row.is_open,
    owner_id: row.owner_id,
    owner: byId.get(row.owner_id)?.name ?? 'Unknown owner',
    managers: managersByRestaurant.get(row.id) ?? [],
  }));
}

export async function loadHighlights(): Promise<AdminHighlight[]> {
  const { data, error } = await supabase
    .from('home_highlights')
    .select('id, title, subtitle, image_url, kind, sort_order, is_active, created_at, restaurant_id, badge, cta_label')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveHighlight(id: string | null, input: HighlightInput) {
  const result = id
    ? await supabase.from('home_highlights').update(input).eq('id', id)
    : await supabase.from('home_highlights').insert(input);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteHighlight(id: string) {
  const { error } = await supabase.from('home_highlights').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

function asRecord(value: Json): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

function normalizeProfile(value: unknown): { email: string; full_name: string | null } | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0] as { email?: string; full_name?: string | null } | undefined;
    return first?.email ? { email: first.email, full_name: first.full_name ?? null } : null;
  }
  const profile = value as { email?: string; full_name?: string | null };
  return profile.email ? { email: profile.email, full_name: profile.full_name ?? null } : null;
}
