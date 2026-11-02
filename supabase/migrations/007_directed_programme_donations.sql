-- Allow a donor to direct one donation to exactly one destination:
-- the foundation generally, one campaign, or one programme.
alter table public.donations
  add column if not exists programme_id uuid references public.programmes(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'donations_single_destination_check'
      and conrelid = 'public.donations'::regclass
  ) then
    alter table public.donations
      add constraint donations_single_destination_check
      check (not (campaign_id is not null and programme_id is not null));
  end if;
end $$;

alter table public.programmes
  add column if not exists amount_raised numeric(14,2) not null default 0
  check (amount_raised >= 0);

create index if not exists donations_programme_id_idx
  on public.donations(programme_id);

-- Recalculate totals from verified paid donations only. This also handles
-- status changes, refunds, deletions and moving a donation between targets.
create or replace function public.refresh_campaign_raised()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    if old.campaign_id is not null then
      update public.campaigns c
      set amount_raised = coalesce((
        select sum(d.amount) from public.donations d
        where d.campaign_id = old.campaign_id and d.status = 'paid'
      ), 0)
      where c.id = old.campaign_id;
    end if;
    if old.programme_id is not null then
      update public.programmes p
      set amount_raised = coalesce((
        select sum(d.amount) from public.donations d
        where d.programme_id = old.programme_id and d.status = 'paid'
      ), 0)
      where p.id = old.programme_id;
    end if;
  end if;

  if tg_op <> 'DELETE' then
    if new.campaign_id is not null then
      update public.campaigns c
      set amount_raised = coalesce((
        select sum(d.amount) from public.donations d
        where d.campaign_id = new.campaign_id and d.status = 'paid'
      ), 0)
      where c.id = new.campaign_id;
    end if;
    if new.programme_id is not null then
      update public.programmes p
      set amount_raised = coalesce((
        select sum(d.amount) from public.donations d
        where d.programme_id = new.programme_id and d.status = 'paid'
      ), 0)
      where p.id = new.programme_id;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists donations_refresh_campaign_total on public.donations;
create trigger donations_refresh_campaign_total
after insert or update or delete on public.donations
for each row execute function public.refresh_campaign_raised();

update public.campaigns c
set amount_raised = coalesce((
  select sum(d.amount) from public.donations d
  where d.campaign_id = c.id and d.status = 'paid'
), 0);

update public.programmes p
set amount_raised = coalesce((
  select sum(d.amount) from public.donations d
  where d.programme_id = p.id and d.status = 'paid'
), 0);
