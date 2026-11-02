create or replace function public.protect_super_admin_staff_role()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare actor_is_super_admin boolean;
begin
  -- Service-role bootstrap and trusted backend administration have no auth.uid().
  if auth.uid() is null then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;

  select exists(
    select 1 from public.staff_profiles
    where user_id=auth.uid() and role='super_admin' and is_active=true
  ) into actor_is_super_admin;

  if tg_op in ('UPDATE','DELETE') and old.role='super_admin' and not actor_is_super_admin then
    raise exception 'Only an active super administrator can modify a super administrator account.';
  end if;

  if tg_op in ('INSERT','UPDATE') and new.role='super_admin' and not actor_is_super_admin then
    raise exception 'Only an active super administrator can assign the super administrator role.';
  end if;

  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists protect_super_admin_staff_role on public.staff_profiles;
create trigger protect_super_admin_staff_role
before insert or update or delete on public.staff_profiles
for each row execute function public.protect_super_admin_staff_role();
