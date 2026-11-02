-- Keep campaign progress tied to confirmed donations, never to manual content edits.
create or replace function public.refresh_campaign_raised()
returns trigger language plpgsql security definer set search_path=public
as $$
declare affected_campaign uuid;
begin
 if tg_op <> 'INSERT' and old.campaign_id is not null then
  update public.campaigns c set amount_raised=coalesce((select sum(d.amount) from public.donations d where d.campaign_id=old.campaign_id and d.status='paid'),0) where c.id=old.campaign_id;
 end if;
 if tg_op <> 'DELETE' and new.campaign_id is not null then
  update public.campaigns c set amount_raised=coalesce((select sum(d.amount) from public.donations d where d.campaign_id=new.campaign_id and d.status='paid'),0) where c.id=new.campaign_id;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists donations_refresh_campaign_total on public.donations;
create trigger donations_refresh_campaign_total after insert or update or delete on public.donations for each row execute function public.refresh_campaign_raised();
update public.campaigns c set amount_raised=coalesce((select sum(d.amount) from public.donations d where d.campaign_id=c.id and d.status='paid'),0);
