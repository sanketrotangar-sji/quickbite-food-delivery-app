import {
  countByKey,
  summarizeOrderPipeline,
  summarizeRioTurns,
  type CountBucket,
  type OrderPipelineSummary,
  type RioTurnSummary,
} from '@quickbite/domain';
import type { Database, Json } from '@quickbite/db';

import { db } from '../supabase';

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
  lat: number | null;
  lng: number | null;
  offer_percent: number | null;
  prep_minutes: number | null;
  capacity_threshold: number;
};

export type AdminTicket = {
  id: string;
  order_id: string;
  customer_id: string;
  issue_type: string;
  description: string;
  status: Database['public']['Enums']['ticket_status'];
  urgency: Database['public']['Enums']['ticket_urgency'];
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  order_status: string | null;
  order_total: number | null;
  restaurant_name: string | null;
};

export type AdminOrderRow = {
  id: string;
  status: Database['public']['Enums']['order_status'];
  total_amount: number;
  delivery_address: string;
  placed_at: string;
  restaurant_id: string;
  restaurant_name: string | null;
  customer_name: string | null;
  refunded_at: string | null;
};

export type AdminRider = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_online: boolean;
  active_orders: number;
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

function resolveLimit(limit: unknown, fallback = 50): number {
  return typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : fallback;
}

type AdminOverviewPayload = {
  restaurants?: number;
  owners?: number;
  open_restaurants?: number;
  applications_by_status?: Record<string, number>;
  profiles_by_role?: Record<string, number>;
  active_orders?: number;
};

export async function loadAdminSummary(): Promise<AdminSummary> {
  const [overviewRes, orders] = await Promise.all([
    db().rpc('admin_overview'),
    db()
      .from('orders')
      .select('id, status, total_amount, delivery_address, placed_at')
      .order('placed_at', { ascending: false })
      .range(0, 7),
  ]);
  if (overviewRes.error) throw new Error(overviewRes.error.message);

  const overview = asRecord(overviewRes.data) as AdminOverviewPayload;
  const roles = overview.profiles_by_role ?? {};
  const apps = overview.applications_by_status ?? {};
  const people = Object.values(roles).reduce((sum, n) => sum + Number(n ?? 0), 0);
  const roleHint = ['customer', 'restaurant_owner', 'restaurant_manager', 'rider', 'admin']
    .filter((role) => Number(roles[role] ?? 0) > 0)
    .map((role) => `${roles[role]} ${role.replace('restaurant_', '')}`)
    .join(' · ');

  return {
    restaurants: Number(overview.restaurants ?? 0),
    owners: Number(overview.owners ?? 0),
    openRestaurants: Number(overview.open_restaurants ?? 0),
    pendingApps: Number(apps.pending ?? 0),
    people,
    roleHint: roleHint || 'No roles yet',
    liveOrders: typeof overview.active_orders === 'number' ? overview.active_orders : 0,
    recent: orders.error ? [] : (orders.data ?? []),
  };
}

export async function loadAdminApplications(limit: number | unknown = 50): Promise<AdminApplication[]> {
  const pageSize = resolveLimit(limit, 50);
  const { data, error } = await db()
    .from('applications')
    .select('id, kind, status, payload, review_note, applicant_id, profiles:applicant_id (email, full_name)')
    .order('created_at', { ascending: false })
    .range(0, pageSize - 1);
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
  const { error } = await db().rpc('admin_review_application', {
    p_application_id: id,
    p_approve: approve,
    ...(note ? { p_note: note } : {}),
  });
  if (error) throw new Error(error.message);
}

export async function loadAdminUsers(limit: number | unknown = 50): Promise<AdminUser[]> {
  const pageSize = resolveLimit(limit, 50);
  const { data, error } = await db()
    .from('profiles')
    .select('id, email, full_name, phone, role')
    .order('email')
    .range(0, pageSize - 1);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadAdminRestaurants(limit: number | unknown = 50): Promise<AdminRestaurant[]> {
  const pageSize = resolveLimit(limit, 50);
  const restaurants = await db()
    .from('restaurants')
    .select(
      'id, name, branch_name, cuisine, address, is_open, owner_id, lat, lng, offer_percent, prep_minutes, capacity_threshold',
    )
    .order('name')
    .range(0, pageSize - 1);
  if (restaurants.error) throw new Error(restaurants.error.message);

  const restaurantRows = restaurants.data ?? [];
  if (restaurantRows.length === 0) return [];

  const restaurantIds = restaurantRows.map((row) => row.id);
  const members = await db()
    .from('restaurant_members')
    .select('restaurant_id, user_id, status')
    .eq('status', 'active')
    .in('restaurant_id', restaurantIds);
  if (members.error) throw new Error(members.error.message);

  const userIds = [
    ...new Set([
      ...restaurantRows.map((row) => row.owner_id),
      ...(members.data ?? []).map((row) => row.user_id),
    ]),
  ];
  const profiles =
    userIds.length > 0
      ? await db().from('profiles').select('id, email, full_name').in('id', userIds)
      : { data: [], error: null };
  if (profiles.error) throw new Error(profiles.error.message);

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

  return restaurantRows.map((row) => ({
    id: row.id,
    name: row.name,
    branch_name: row.branch_name,
    cuisine: row.cuisine,
    address: row.address,
    is_open: row.is_open,
    owner_id: row.owner_id,
    owner: byId.get(row.owner_id)?.name ?? 'Unknown owner',
    managers: managersByRestaurant.get(row.id) ?? [],
    lat: row.lat,
    lng: row.lng,
    offer_percent: row.offer_percent,
    prep_minutes: row.prep_minutes,
    capacity_threshold: Number(row.capacity_threshold ?? 8),
  }));
}

export async function setAdminRestaurantOpen(id: string, isOpen: boolean) {
  const { error } = await db().from('restaurants').update({ is_open: isOpen }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateAdminRestaurantOps(
  id: string,
  patch: {
    lat?: number | null;
    lng?: number | null;
    address?: string;
    offer_percent?: number | null;
    prep_minutes?: number | null;
    capacity_threshold?: number;
  },
) {
  const args: Database['public']['Functions']['admin_update_restaurant_ops']['Args'] = {
    p_restaurant_id: id,
  };
  if (typeof patch.lat === 'number') args.p_lat = patch.lat;
  if (typeof patch.lng === 'number') args.p_lng = patch.lng;
  if (patch.address !== undefined) args.p_address = patch.address;
  if (typeof patch.offer_percent === 'number') args.p_offer_percent = patch.offer_percent;
  if (typeof patch.prep_minutes === 'number') args.p_prep_minutes = patch.prep_minutes;
  if (typeof patch.capacity_threshold === 'number') args.p_capacity_threshold = patch.capacity_threshold;

  const { error } = await db().rpc('admin_update_restaurant_ops', args);
  if (error) throw new Error(error.message);
}

export async function loadAdminTickets(limit: number | unknown = 50): Promise<AdminTicket[]> {
  const pageSize = resolveLimit(limit, 50);
  const { data, error } = await db()
    .from('support_tickets')
    .select(
      `
      id, order_id, customer_id, issue_type, description, status, urgency, created_at,
      customer:profiles!support_tickets_customer_id_fkey (full_name, email),
      order:orders!support_tickets_order_id_fkey (
        status, total_amount,
        restaurant:restaurants!orders_restaurant_id_fkey (name)
      )
    `,
    )
    .order('created_at', { ascending: false })
    .range(0, pageSize - 1);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const customer = normalizeProfile(row.customer);
    const order = Array.isArray(row.order) ? row.order[0] : row.order;
    const restaurant = order?.restaurant
      ? Array.isArray(order.restaurant)
        ? order.restaurant[0]
        : order.restaurant
      : null;
    return {
      id: row.id,
      order_id: row.order_id,
      customer_id: row.customer_id,
      issue_type: row.issue_type,
      description: row.description,
      status: row.status,
      urgency: row.urgency,
      created_at: row.created_at,
      customer_name: customer?.full_name ?? null,
      customer_email: customer?.email ?? null,
      order_status: order?.status ?? null,
      order_total: order?.total_amount != null ? Number(order.total_amount) : null,
      restaurant_name: restaurant?.name ?? null,
    };
  });
}

export async function setAdminTicketStatus(
  ticketId: string,
  status: Database['public']['Enums']['ticket_status'],
) {
  const { error } = await db().rpc('admin_set_ticket_status', {
    p_ticket_id: ticketId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

export async function loadAdminOrders(query: string, limit: number | unknown = 50): Promise<AdminOrderRow[]> {
  const pageSize = resolveLimit(limit, 50);
  const needle = query.trim().replace(/^#/, '');
  let request = db()
    .from('orders')
    .select(
      `
      id, status, total_amount, delivery_address, placed_at, restaurant_id, refunded_at,
      restaurant:restaurants!orders_restaurant_id_fkey (name),
      customer:profiles!orders_customer_id_fkey (full_name)
    `,
    )
    .order('placed_at', { ascending: false })
    .range(0, pageSize - 1);
  if (needle.length >= 4) {
    request = request.or(`id.ilike.%${needle}%,delivery_address.ilike.%${needle}%`);
  }
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const restaurant = Array.isArray(row.restaurant) ? row.restaurant[0] : row.restaurant;
    const customer = normalizeProfile(row.customer);
    return {
      id: row.id,
      status: row.status,
      total_amount: Number(row.total_amount),
      delivery_address: row.delivery_address,
      placed_at: row.placed_at,
      restaurant_id: row.restaurant_id,
      restaurant_name: restaurant?.name ?? null,
      customer_name: customer?.full_name ?? null,
      refunded_at: row.refunded_at ?? null,
    };
  });
}

export async function adminForceOrderStatus(
  orderId: string,
  status: Database['public']['Enums']['order_status'],
  note: string,
) {
  const { error } = await db().rpc('admin_force_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_note: note,
  });
  if (error) throw new Error(error.message);
}

export async function adminMarkOrderRefunded(orderId: string, note: string) {
  const { error } = await db().rpc('admin_mark_order_refunded', {
    p_order_id: orderId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
}

export async function loadAdminRiders(): Promise<AdminRider[]> {
  const [profiles, live] = await Promise.all([
    db()
      .from('profiles')
      .select('id, email, full_name, phone, is_online')
      .eq('role', 'rider')
      .order('full_name'),
    db()
      .from('orders')
      .select('rider_id')
      .in('status', ['preparing', 'ready', 'out_for_delivery'])
      .not('rider_id', 'is', null),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  const counts = new Map<string, number>();
  for (const row of live.data ?? []) {
    if (!row.rider_id) continue;
    counts.set(row.rider_id, (counts.get(row.rider_id) ?? 0) + 1);
  }
  return (profiles.data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    phone: row.phone,
    is_online: Boolean(row.is_online),
    active_orders: counts.get(row.id) ?? 0,
  }));
}

export async function loadHighlights(): Promise<AdminHighlight[]> {
  const { data, error } = await db()
    .from('home_highlights')
    .select('id, title, subtitle, image_url, kind, sort_order, is_active, created_at, restaurant_id, badge, cta_label')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveHighlight(id: string | null, input: HighlightInput) {
  const result = id
    ? await db().from('home_highlights').update(input).eq('id', id)
    : await db().from('home_highlights').insert(input);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteHighlight(id: string) {
  const { error } = await db().from('home_highlights').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export type LlmProvider = 'groq' | 'ollama';

export type AdminLlmConfig = {
  id: string;
  provider: LlmProvider;
  chat_model: string;
  is_active: boolean;
  updated_at: string;
  updated_by: string | null;
};

export async function loadLlmConfigs(): Promise<AdminLlmConfig[]> {
  const { data, error } = await db()
    .from('llm_config')
    .select('id, provider, chat_model, is_active, updated_at, updated_by')
    .order('provider');
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminLlmConfig[];
}

export async function updateLlmChatModel(id: string, chatModel: string) {
  const trimmed = chatModel.trim();
  if (!trimmed) throw new Error('Chat model cannot be empty.');
  const { error } = await db()
    .from('llm_config')
    .update({ chat_model: trimmed })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function activateLlmConfig(id: string) {
  const { error } = await db().rpc('activate_llm_config', { p_id: id });
  if (error) throw new Error(error.message);
}

export type CrmSegment = 'new' | 'frequent' | 'churned' | 'active' | 'all';

export type CrmSegmentCount = {
  segment: string;
  member_count: number;
};

export type CrmSegmentMember = {
  customer_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  joined_at: string;
  delivered_count: number;
  delivered_60d: number;
  last_delivered_at: string | null;
  segment: string;
};

export type CrmCampaignStat = {
  campaign_id: string;
  title: string;
  target_segment: string;
  discount_percent: number;
  status: string;
  starts_at: string;
  ends_at: string;
  enrolled: number;
  redeemed: number;
  expired_unredeemed: number;
};

export async function loadCrmSegmentCounts(): Promise<CrmSegmentCount[]> {
  const { data, error } = await db().rpc('crm_segment_counts');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ segment: string; member_count: number | string }>).map((row) => ({
    segment: row.segment,
    member_count: Number(row.member_count),
  }));
}

export async function loadCrmSegmentMembers(segment: CrmSegment, limit = 80): Promise<CrmSegmentMember[]> {
  const { data, error } = await db().rpc('crm_list_segment_members', {
    p_segment: segment,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CrmSegmentMember[];
}

export async function loadCrmCampaignStats(): Promise<CrmCampaignStat[]> {
  const { data, error } = await db().rpc('crm_campaign_stats', { p_campaign_id: null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    campaign_id: String(row['campaign_id'] ?? ''),
    title: String(row['title'] ?? ''),
    target_segment: String(row['target_segment'] ?? ''),
    discount_percent: Number(row['discount_percent'] ?? 0),
    status: String(row['status'] ?? ''),
    starts_at: String(row['starts_at'] ?? ''),
    ends_at: String(row['ends_at'] ?? ''),
    enrolled: Number(row['enrolled'] ?? 0),
    redeemed: Number(row['redeemed'] ?? 0),
    expired_unredeemed: Number(row['expired_unredeemed'] ?? 0),
  }));
}

export async function createCrmCampaign(input: {
  title: string;
  description?: string | undefined;
  target_segment: Exclude<CrmSegment, 'active'>;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
  restaurant_id?: string | null | undefined;
}) {
  const { data, error } = await db().rpc('crm_create_campaign', {
    p_title: input.title,
    p_description: input.description ?? null,
    p_target_segment: input.target_segment,
    p_discount_percent: input.discount_percent,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_restaurant_id: input.restaurant_id ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function launchCrmCampaign(campaignId: string) {
  const { data, error } = await db().rpc('crm_launch_campaign', { p_campaign_id: campaignId });
  if (error) throw new Error(error.message);
  return data as { campaign_id: string; status: string; enrolled: number; notified: number };
}

export async function endCrmCampaign(campaignId: string) {
  const { error } = await db().rpc('crm_end_campaign', { p_campaign_id: campaignId });
  if (error) throw new Error(error.message);
}

export type OpsAuditRow = {
  id: string;
  action: string;
  order_id: string | null;
  created_at: string;
};

export type OpsMetrics = {
  sinceHours: number;
  sinceIso: string;
  orders: OrderPipelineSummary;
  rio: RioTurnSummary;
  automationByKind: CountBucket[];
  recentAutomation: { id: string; kind: string; order_id: string | null; created_at: string }[];
  auditByAction: CountBucket[];
  recentAudit: OpsAuditRow[];
};

export async function loadOpsMetrics(options?: { sinceHours?: number }): Promise<OpsMetrics> {
  const sinceHours =
    typeof options?.sinceHours === 'number' && Number.isFinite(options.sinceHours) && options.sinceHours > 0
      ? Math.min(168, Math.floor(options.sinceHours))
      : 24;
  const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  const [orders, rio, automation, audit] = await Promise.all([
    db().from('orders').select('id, status, placed_at').gte('placed_at', sinceIso),
    db()
      .from('rio_events')
      .select('latency_ms, error, provider, model, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(2000),
    db()
      .from('automation_events')
      .select('id, kind, order_id, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500),
    db()
      .from('admin_audit_log')
      .select('id, action, order_id, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const firstError = orders.error ?? rio.error ?? automation.error ?? audit.error;
  if (firstError) throw new Error(firstError.message);

  const orderRows = orders.data ?? [];
  const rioRows = rio.data ?? [];
  const automationRows = automation.data ?? [];
  const auditRows = audit.data ?? [];

  return {
    sinceHours,
    sinceIso,
    orders: summarizeOrderPipeline(orderRows),
    rio: summarizeRioTurns(rioRows),
    automationByKind: countByKey(automationRows.map((row) => ({ key: row.kind }))),
    recentAutomation: automationRows.slice(0, 12).map((row) => ({
      id: row.id,
      kind: row.kind,
      order_id: row.order_id,
      created_at: row.created_at,
    })),
    auditByAction: countByKey(auditRows.map((row) => ({ key: row.action }))),
    recentAudit: auditRows.slice(0, 12).map((row) => ({
      id: row.id,
      action: row.action,
      order_id: row.order_id,
      created_at: row.created_at,
    })),
  };
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
