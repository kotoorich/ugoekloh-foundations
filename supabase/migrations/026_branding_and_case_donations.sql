-- Foundation branding, social links, and donations directed to a child case.

-- A donor may direct a donation to a published child case. Kept alongside the
-- existing programme_id so the "one destination" rule still holds.
alter table public.donations
  add column if not exists beneficiary_id uuid references public.beneficiaries(id) on delete set null;

create index if not exists donations_beneficiary_id_idx on public.donations(beneficiary_id);

-- Replace the earlier two-way destination rule with a three-way one: at most one
-- of campaign, programme or child case may be set on a single donation.
alter table public.donations drop constraint if exists donations_single_destination_check;
alter table public.donations drop constraint if exists donations_one_destination_check;
alter table public.donations add constraint donations_one_destination_check
  check (
    (case when campaign_id is not null then 1 else 0 end)
  + (case when programme_id is not null then 1 else 0 end)
  + (case when beneficiary_id is not null then 1 else 0 end) <= 1
  );

-- Branding and public-contact settings for the foundation website.
alter table public.foundation_settings
  add column if not exists logo_path text,
  add column if not exists tagline text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists x_url text,
  add column if not exists linkedin_url text,
  add column if not exists about_summary text;

-- The foundation's official name is "Ugoekloh Foundations". Migration 002 left a
-- wrong spaced default; correct it at the source and normalise any old rows.
alter table public.foundation_settings
  alter column foundation_name set default 'Ugoekloh Foundations';

update public.foundation_settings
set foundation_name = 'Ugoekloh Foundations', updated_at = now()
where id = 1
  and (foundation_name is null
       or foundation_name in ('Ugo E Kloh Foundation','Ugo E Kloh Foundations',
                              'Ugoekloh Foundation','Ugo E Kloh'));

-- Amount received for a child case, from verified paid donations only. Mirrors
-- the programme behaviour in migration 007 so both progress bars are computed
-- the same way and neither can be edited by hand.
create or replace function public.refresh_beneficiary_raised()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op <> 'INSERT' and old.beneficiary_id is not null then
    update public.beneficiaries b
    set amount_raised = coalesce((
      select sum(d.amount) from public.donations d
      where d.beneficiary_id = old.beneficiary_id and d.status = 'paid'
    ), 0)
    where b.id = old.beneficiary_id;
  end if;
  if tg_op <> 'DELETE' and new.beneficiary_id is not null then
    update public.beneficiaries b
    set amount_raised = coalesce((
      select sum(d.amount) from public.donations d
      where d.beneficiary_id = new.beneficiary_id and d.status = 'paid'
    ), 0)
    where b.id = new.beneficiary_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter table public.beneficiaries
  add column if not exists amount_raised numeric(14,2) not null default 0
  check (amount_raised >= 0);

drop trigger if exists donations_refresh_beneficiary_total on public.donations;
create trigger donations_refresh_beneficiary_total
after insert or update or delete on public.donations
for each row execute function public.refresh_beneficiary_raised();
