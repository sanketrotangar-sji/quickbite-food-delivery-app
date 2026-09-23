-- Approved rider applications must own profiles.role = rider.
-- Older reviews could mark the application approved without changing that column,
-- so the phone kept showing the application instead of the rider home.

do $$
declare
  applicant uuid;
begin
  for applicant in
    select a.applicant_id
    from public.applications a
    join public.profiles p on p.id = a.applicant_id
    where a.kind = 'rider'::public.application_kind
      and a.status = 'approved'::public.application_status
      and p.role = 'customer'::public.app_role
  loop
    perform private.grant_role(applicant, 'rider'::public.app_role);
  end loop;
end $$;
