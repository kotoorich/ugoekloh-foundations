-- Add the optional dedicated call-line field used by the Foundation Settings form.
-- IF NOT EXISTS makes this safe if the column was added manually already.
ALTER TABLE public.foundation_settings
  ADD COLUMN IF NOT EXISTS call_line text;
