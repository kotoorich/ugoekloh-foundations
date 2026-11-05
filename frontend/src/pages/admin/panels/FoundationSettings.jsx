import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { supabase, uploadImage } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { GuidePanel, ImageField, PageHeader, SkeletonList, TextArea, TextField, useToast } from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

const DEFAULTS = {
  foundation_name: 'Ugoekloh Foundations',
  tagline: '',
  contact_email: '',
  contact_phone: '',
  call_line: '',
  address: '',
  about_summary: '',
  logo_path: '',
  facebook_url: '',
  instagram_url: '',
  x_url: '',
  linkedin_url: '',
};

export default function FoundationSettings() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('foundation_settings').select('*').eq('id', 1).maybeSingle();
      if (error) toast.error(`Settings could not be loaded. ${error.message}`);
      if (data) setForm({ ...DEFAULTS, ...Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, data[key] ?? DEFAULTS[key]])) });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="admin-panel admin-panel-narrow">
      <PageHeader
        eyebrow="FOUNDATION IDENTITY"
        title="Foundation settings"
        description="The name, contact details and branding shown across the public website."
      />
      <GuidePanel {...SECTIONS.settings.guide} />

      {loading ? <SkeletonList rows={3} /> : (
        <form
          className="admin-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            const { error } = await supabase
              .from('foundation_settings')
              .update({ ...form, updated_at: new Date().toISOString() })
              .eq('id', 1);
            setSaving(false);
            if (error) toast.error(`Settings could not be saved. ${error.message}`);
            else toast.success('Foundation settings saved.');
          }}
        >
          <fieldset className="admin-fieldset">
            <legend>Identity</legend>
            <TextField label="Foundation name" value={form.foundation_name} onChange={set('foundation_name')} required hint="The official name is Ugoekloh Foundations." />
            <TextField label="Tagline" value={form.tagline} onChange={set('tagline')} placeholder="Every child deserves a chance" />
            <TextArea label="About the foundation" value={form.about_summary} onChange={set('about_summary')} rows={4} />
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Logo</legend>
            <ImageField
              label="Foundation logo"
              value={form.logo_path}
              onChange={set('logo_path')}
              onUpload={async (file) => {
                try { return await uploadImage(file, accessToken); }
                catch (error) { toast.error(error.message); throw error; }
              }}
              hint="A square image works best. It appears in the website header, footer and here. Leave empty to use the built-in logo."
            />
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Contact details</legend>
            <TextField label="Public contact email" type="email" value={form.contact_email} onChange={set('contact_email')} />
            <TextField label="General contact number" value={form.contact_phone} onChange={set('contact_phone')} />
            <TextField label="Dedicated call line number" value={form.call_line} onChange={set('call_line')} />
            <TextArea label="Foundation address" value={form.address} onChange={set('address')} rows={2} />
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Social media</legend>
            <TextField label="Facebook page" type="url" value={form.facebook_url} onChange={set('facebook_url')} placeholder="https://facebook.com/…" />
            <TextField label="Instagram profile" type="url" value={form.instagram_url} onChange={set('instagram_url')} placeholder="https://instagram.com/…" />
            <TextField label="X (Twitter) profile" type="url" value={form.x_url} onChange={set('x_url')} placeholder="https://x.com/…" />
            <TextField label="LinkedIn page" type="url" value={form.linkedin_url} onChange={set('linkedin_url')} placeholder="https://linkedin.com/company/…" />
          </fieldset>

          <div className="admin-form-actions">
            <button className="button" disabled={saving}><Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save settings'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
