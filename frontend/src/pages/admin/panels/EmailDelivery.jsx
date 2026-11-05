import React, { useEffect, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { apiFetch, supabase, shortDate } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import {
  CheckField, GuidePanel, PageHeader, SelectField, SkeletonList, StatusPill,
  TextField, useToast,
} from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

const PROVIDERS = [
  { value: 'gmail', label: 'Gmail' },
  { value: 'sendpulse', label: 'SendPulse' },
];

export default function EmailDelivery() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState({ enabled: false, provider: 'gmail' });
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const current = await apiFetch('/api/admin/email/settings', accessToken);
      setSettings({ enabled: Boolean(current.enabled), provider: current.provider || 'gmail' });
    } catch (error) {
      toast.error(error.message);
    }
    const { data } = await supabase.from('email_delivery_logs').select('id,recipient,subject,status,created_at').order('created_at', { ascending: false }).limit(50);
    setLog(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="admin-panel admin-panel-narrow">
      <PageHeader
        eyebrow="EMAIL DELIVERY"
        title="Automatic emails"
        description="Confirmation emails sent when someone donates, volunteers or makes an enquiry."
      />
      <GuidePanel {...SECTIONS.email_settings.guide} />

      {loading ? <SkeletonList rows={2} /> : (
        <>
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await apiFetch('/api/admin/email/settings', accessToken, {
                  method: 'PUT',
                  body: JSON.stringify(settings),
                });
                toast.success('Email settings saved.');
              } catch (error) {
                toast.error(error.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <CheckField
              label="Send automatic emails"
              checked={settings.enabled}
              onChange={(value) => setSettings((current) => ({ ...current, enabled: value }))}
              hint="Turn this off to pause sending. Submissions are still saved in the dashboard."
            />
            <SelectField
              label="Email provider"
              value={settings.provider}
              onChange={(value) => setSettings((current) => ({ ...current, provider: value }))}
              options={PROVIDERS}
            />
            <div className="admin-form-actions">
              <button className="button" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
            </div>
          </form>

          <section className="admin-card">
            <div className="admin-card-head">
              <div>
                <h2>Send a test email</h2>
                <p>Confirm delivery works before relying on it.</p>
              </div>
            </div>
            <form
              className="admin-form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                setTesting(true);
                try {
                  await apiFetch('/api/admin/email/test', accessToken, {
                    method: 'POST',
                    body: JSON.stringify({ recipient: testTo }),
                  });
                  toast.success('Test email sent. Check the inbox.');
                  setTestTo('');
                  load();
                } catch (error) {
                  toast.error(error.message);
                } finally {
                  setTesting(false);
                }
              }}
            >
              <TextField label="Send to" type="email" value={testTo} onChange={setTestTo} placeholder="you@ugoeklohfoundation.org" required />
              <div className="admin-form-actions">
                <button className="button button-outline" disabled={testing}><Send size={16} aria-hidden="true" /> {testing ? 'Sending…' : 'Send test email'}</button>
              </div>
            </form>
          </section>

          <section className="admin-card">
            <div className="admin-card-head">
              <div>
                <h2>Recent deliveries</h2>
                <p>The last 50 emails the foundation attempted to send.</p>
              </div>
            </div>
            {log.length === 0 ? (
              <p className="admin-muted">No emails have been sent yet.</p>
            ) : (
              <ul className="admin-activity-list">
                {log.map((entry) => (
                  <li key={entry.id}>
                    <span className="delivery-main">
                      <Mail size={14} aria-hidden="true" />
                      <strong>{entry.subject}</strong>
                      <small>{entry.recipient}</small>
                    </span>
                    <span className="delivery-meta">
                      <StatusPill status={entry.status} />
                      <small>{shortDate(entry.created_at)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
