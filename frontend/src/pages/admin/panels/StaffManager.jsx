import React, { useEffect, useMemo, useState } from 'react';
import { Plus, UserRoundCog } from 'lucide-react';
import { apiUrl, supabase, shortDate } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import {
  CheckField, DataTable, EmptyState, GuidePanel, Modal, PageHeader, SearchField,
  SelectField, SkeletonList, StatusPill, TextField, useToast,
} from '../../../components/AdminUI';
import { ROLE_LABELS, SECTIONS } from '../modules';

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

export default function StaffManager() {
  const { role, accessToken } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const isSuperAdmin = role === 'super_admin';

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('user_id,full_name,role,is_active,must_change_password,created_at')
      .order('full_name');
    if (error) toast.error(`Staff accounts could not be loaded. ${error.message}`);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => `${row.full_name || ''} ${row.role || ''}`.toLowerCase().includes(needle));
  }, [rows, search]);

  const columns = [
    { key: 'full_name', label: 'Name', render: (row) => <strong>{row.full_name || 'Unnamed'}</strong> },
    { key: 'role', label: 'Role', render: (row) => ROLE_LABELS[row.role] || row.role },
    { key: 'is_active', label: 'Status', render: (row) => <StatusPill status={row.is_active ? 'active' : 'inactive'} /> },
    { key: 'created_at', label: 'Added', render: (row) => shortDate(row.created_at) },
    {
      key: 'actions', label: 'Actions', sortable: false, align: 'right',
      render: (row) => (
        <div className="row-actions">
          <SelectField
            label="Role"
            value={row.role}
            options={ROLE_OPTIONS}
            onChange={async (value) => {
              const { error } = await supabase.from('staff_profiles').update({ role: value }).eq('user_id', row.user_id);
              if (error) toast.error(error.message);
              else { toast.success('Role updated.'); load(); }
            }}
          />
          <button
            type="button"
            className="button-text"
            onClick={async () => {
              const { error } = await supabase.from('staff_profiles').update({ is_active: !row.is_active }).eq('user_id', row.user_id);
              if (error) toast.error(error.message);
              else { toast.success(row.is_active ? 'Account deactivated.' : 'Account reactivated.'); load(); }
            }}
          >
            {row.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-panel">
      <PageHeader
        eyebrow="ACCESS CONTROL"
        title="Staff accounts"
        description="Create accounts and control what each person can reach."
        actions={isSuperAdmin && <button type="button" className="button" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> New staff account</button>}
      />
      <GuidePanel {...SECTIONS.staff_profiles.guide} />

      <div className="admin-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Search staff…" />
        <span className="admin-count">{filtered.length} accounts</span>
      </div>

      {loading ? <SkeletonList /> : (
        <DataTable
          columns={columns}
          rows={filtered}
          emptyState={<EmptyState icon={UserRoundCog} title="No staff accounts" description="Create the first staff account to give someone access." />}
        />
      )}

      <CreateStaff
        open={creating}
        accessToken={accessToken}
        onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); toast.success('Staff account created. They must change the temporary password at first sign-in.'); load(); }}
        onError={(message) => toast.error(message)}
      />
    </div>
  );
}

function CreateStaff({ open, accessToken, onClose, onCreated, onError }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'editor', password: '' });
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={open}
      title="Create a staff account"
      eyebrow="NEW STAFF MEMBER"
      description="They will be asked to set their own password the first time they sign in."
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            const response = await fetch(`${apiUrl}/api/admin/staff`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
              body: JSON.stringify(form),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.detail || 'The account could not be created.');
            setForm({ full_name: '', email: '', role: 'editor', password: '' });
            onCreated();
          } catch (error) {
            onError(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextField label="Full name" value={form.full_name} onChange={(value) => setForm((current) => ({ ...current, full_name: value }))} required />
        <TextField label="Work email" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} required />
        <SelectField label="Role" value={form.role} onChange={(value) => setForm((current) => ({ ...current, role: value }))} options={ROLE_OPTIONS} hint="Choose the smallest role that lets them do their job." />
        <TextField label="Temporary password" type="password" value={form.password} onChange={(value) => setForm((current) => ({ ...current, password: value }))} required hint="At least 12 characters. Share it through a secure channel." />
        <div className="admin-form-actions">
          <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </div>
      </form>
    </Modal>
  );
}
