import { throwApiError } from './errors';
import { supabase } from './supabaseClient';

export async function setRiderDuty(isOnline: boolean) {
  const { data, error } = await supabase.rpc('rider_set_duty', {
    p_is_online: isOnline,
  });
  if (error) throwApiError(error, 'Could not update duty status.');
  return data;
}

export async function updateRiderLocation(orderId: string, latitude: number, longitude: number) {
  const { data, error } = await supabase.rpc('rider_update_location', {
    p_order_id: orderId,
    p_lat: latitude,
    p_lng: longitude,
  });
  if (error) throwApiError(error, 'Could not update delivery location.');
  return data;
}
