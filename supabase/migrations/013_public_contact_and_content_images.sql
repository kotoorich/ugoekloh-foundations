-- Additional managed imagery and a dedicated public call-line number.
alter table public.foundation_settings add column if not exists call_line text;
alter table public.events add column if not exists image_path text;
alter table public.impact_reports add column if not exists cover_image_path text;
