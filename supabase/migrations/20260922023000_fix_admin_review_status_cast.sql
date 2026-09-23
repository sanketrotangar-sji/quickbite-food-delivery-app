-- Postgres will not assign a bare CASE of text literals to an enum column.
create or replace function public.admin_review_application(
  p_application_id uuid,
  p_approve        boolean,
  p_note           text default null
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row  public.applications;
  v_name text;
  v_addr text;
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can review applications.' using errcode = '42501';
  end if;

  select * into v_row from public.applications where id = p_application_id for update;

  if v_row.id is null then
    raise exception 'Application not found.' using errcode = 'P0001';
  end if;

  if v_row.status is distinct from 'pending'::public.application_status then
    raise exception 'This application was already reviewed.' using errcode = 'P0001';
  end if;

  if p_approve then
    if v_row.kind = 'rider'::public.application_kind then
      perform private.grant_role(v_row.applicant_id, 'rider');
    elsif v_row.kind = 'restaurant_owner'::public.application_kind then
      v_name := trim(v_row.payload ->> 'restaurant_name');
      v_addr := trim(v_row.payload ->> 'address');
      if v_name = '' or v_addr = '' then
        raise exception 'Application is missing restaurant name or address.' using errcode = '22023';
      end if;
      perform private.grant_role(v_row.applicant_id, 'restaurant_owner');
      insert into public.restaurants (
        owner_id, name, address, phone, cuisine, description, branch_name
      )
      values (
        v_row.applicant_id,
        v_name,
        v_addr,
        nullif(trim(v_row.payload ->> 'phone'), ''),
        nullif(trim(v_row.payload ->> 'cuisine'), ''),
        nullif(trim(v_row.payload ->> 'description'), ''),
        nullif(trim(v_row.payload ->> 'branch_name'), '')
      );
    end if;
  end if;

  update public.applications
     set status      = (case when p_approve then 'approved' else 'rejected' end)::public.application_status,
         review_note = nullif(trim(p_note), ''),
         reviewed_by = (select auth.uid()),
         reviewed_at = now()
   where id = p_application_id
  returning * into v_row;

  return v_row;
end;
$$;
