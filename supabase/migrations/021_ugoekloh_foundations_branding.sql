-- Standardise the public foundation name across new and existing installations.
alter table public.foundation_settings
  alter column foundation_name set default 'Ugoekloh Foundations';

update public.foundation_settings
set foundation_name = 'Ugoekloh Foundations',
    updated_at = now()
where id = 1
  and foundation_name in ('Ugo E Kloh Foundation', 'Ugo E Kloh Foundations', 'Ugoekloh Foundation');
