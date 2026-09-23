begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'customer_addresses', 'saved addresses table exists');
select has_table('public', 'push_device_tokens', 'push token table exists');
select has_column('public', 'orders', 'delivery_address_id', 'orders link to saved addresses');

select has_function('public', 'rider_set_duty', array['boolean'], 'secure duty RPC exists');
select has_function(
  'public',
  'rider_update_location',
  array['uuid', 'numeric', 'numeric'],
  'validated rider location RPC exists'
);
select has_function(
  'public',
  'register_push_device',
  array['text', 'text', 'jsonb'],
  'push registration RPC exists'
);
select has_function(
  'public',
  'set_default_customer_address',
  array['uuid'],
  'default address RPC exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_addresses'::regclass),
  'saved addresses enforce RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_device_tokens'::regclass),
  'push tokens enforce RLS'
);
select policies_are(
  'public',
  'customer_addresses',
  array[
    'customer_addresses: owner deletes',
    'customer_addresses: owner inserts',
    'customer_addresses: owner reads',
    'customer_addresses: owner updates'
  ],
  'saved addresses expose owner-only policies'
);
select policies_are(
  'public',
  'push_device_tokens',
  array[
    'push_device_tokens: owner deletes',
    'push_device_tokens: owner inserts',
    'push_device_tokens: owner reads',
    'push_device_tokens: owner updates'
  ],
  'push tokens expose owner-only policies'
);

select function_privs_are(
  'public',
  'rider_set_duty',
  array['boolean'],
  'authenticated',
  array['EXECUTE'],
  'authenticated riders can invoke duty RPC'
);
select function_privs_are(
  'public',
  'rider_update_location',
  array['uuid', 'numeric', 'numeric'],
  'authenticated',
  array['EXECUTE'],
  'authenticated riders can invoke location RPC'
);
select function_privs_are(
  'public',
  'register_push_device',
  array['text', 'text', 'jsonb'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users can register their device'
);
select table_privs_are(
  'public',
  'rider_locations',
  'authenticated',
  array['SELECT'],
  'clients cannot bypass the rider location RPC'
);
select col_is_fk(
  'public',
  'orders',
  'delivery_address_id',
  'orders saved-address reference is constrained'
);

select * from finish();
rollback;
