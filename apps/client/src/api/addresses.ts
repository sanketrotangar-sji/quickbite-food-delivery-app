import type { RealtimeChannel } from '@supabase/supabase-js';

import { throwApiError } from '@/api/errors';
import { supabase } from '@/api/supabaseClient';
import type { AddressDraft, SavedAddress } from '@/lib/addresses';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

type AddressRow = Tables<'customer_addresses'>;

function fromRow(row: AddressRow): SavedAddress {
  return {
    id: row.id,
    label: row.label as SavedAddress['label'],
    nickname: row.nickname,
    line: row.address_line,
    area: row.area,
    landmark: row.landmark ?? '',
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
  };
}

function draftValues(draft: AddressDraft): TablesUpdate<'customer_addresses'> {
  return {
    label: draft.label,
    nickname: draft.nickname.trim(),
    address_line: draft.line.trim(),
    area: draft.area.trim(),
    landmark: draft.landmark.trim() || null,
    lat: draft.lat ?? null,
    lng: draft.lng ?? null,
  };
}

export async function listAddresses(): Promise<{ addresses: SavedAddress[]; selectedId: string | null }> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at');
  if (error) throwApiError(error, 'Could not load saved addresses.');
  const rows = data ?? [];
  const defaultId = rows.find((row) => row.is_default)?.id ?? null;
  const selectedId = defaultId ?? rows[0]?.id ?? null;
  if (!defaultId && selectedId) await setDefaultAddress(selectedId);
  return {
    addresses: rows.map(fromRow),
    selectedId,
  };
}

export async function createAddress(userId: string, id: string, draft: AddressDraft): Promise<SavedAddress> {
  const values = draftValues(draft);
  const insert: TablesInsert<'customer_addresses'> = {
    ...values,
    id,
    customer_id: userId,
    address_line: values.address_line!,
    area: values.area!,
    nickname: values.nickname!,
  };
  const { data, error } = await supabase.from('customer_addresses').insert(insert).select().single();
  if (error) throwApiError(error, 'Could not save this address.');
  return fromRow(data);
}

export async function updateAddress(id: string, draft: AddressDraft): Promise<SavedAddress> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .update(draftValues(draft))
    .eq('id', id)
    .select()
    .single();
  if (error) throwApiError(error, 'Could not update this address.');
  return fromRow(data);
}

export async function removeAddress(id: string) {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
  if (error) throwApiError(error, 'Could not remove this address.');
}

export async function setDefaultAddress(id: string) {
  const { error } = await supabase.rpc('set_default_customer_address', { p_address_id: id });
  if (error) throwApiError(error, 'Could not select this address.');
}

export async function importAddresses(
  userId: string,
  addresses: SavedAddress[],
  selectedId: string | null,
) {
  if (addresses.length === 0) return;
  const rows: TablesInsert<'customer_addresses'>[] = addresses.map((address) => ({
    ...draftValues(address),
    id: address.id,
    customer_id: userId,
    address_line: address.line.trim(),
    area: address.area.trim(),
    nickname: address.nickname.trim(),
    is_default: false,
  }));
  const { error } = await supabase.from('customer_addresses').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throwApiError(error, 'Could not import saved addresses.');
  await setDefaultAddress(
    addresses.some((address) => address.id === selectedId) ? selectedId! : addresses[0].id,
  );
}

export function subscribeToAddresses(userId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(`customer-addresses:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customer_addresses', filter: `customer_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
}
