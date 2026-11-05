import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase, uploadImage, money, shortDate } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import {
  CheckField, ConfirmDialog, DataTable, EmptyState, GuidePanel, ImageField,
  Modal, PageHeader, SearchField, SelectField, SkeletonList, StatusPill,
  TextArea, TextField, useToast,
} from '../../../components/AdminUI';
import { FIELD_LABELS, MULTILINE_FIELDS, SECTIONS } from '../modules';

const IMAGE_FIELDS = ['image_path', 'cover_image_path', 'logo_path'];
const CHECK_FIELDS = ['consent_verified'];
const NUMBER_FIELDS = ['goal_amount', 'sort_order'];
const DATETIME_FIELDS = ['published_at', 'starts_at', 'ends_at'];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft — not visible publicly' },
  { value: 'published', label: 'Published — visible publicly' },
  { value: 'archived', label: 'Archived' },
];

/** Format an ISO timestamp for a datetime-local input. */
function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function blankValue(field) {
  if (field === 'status') return 'draft';
  if (CHECK_FIELDS.includes(field)) return false;
  if (NUMBER_FIELDS.includes(field)) return '';
  return '';
}

/** The primary human-readable column for a section. */
function primaryField(section) {
  const fields = section.fields || [];
  return fields.find((field) => ['title', 'name', 'question'].includes(field)) || fields[0];
}

export default function ContentPanel({ sectionKey }) {
  const section = SECTIONS[sectionKey];
  const { accessToken } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!supabase || !section?.table) return;
    setLoading(true);
    const { data, error } = await supabase
      .from(section.table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) toast.error(`Records could not be loaded. ${error.message}`);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sectionKey]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [rows, search]);

  const key = primaryField(section);
  const columns = useMemo(() => [
    {
      key,
      label: FIELD_LABELS[key] || 'Title',
      sortValue: (row) => row[key] || '',
      render: (row) => (
        <div className="cell-primary">
          <strong>{row[key] || 'Untitled'}</strong>
          {row.category && <small>{row.category}</small>}
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'created_at', label: 'Created', render: (row) => shortDate(row.created_at) },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right',
      render: (row) => (
        <div className="row-actions">
          <button type="button" className="button-text" onClick={() => setEditing(row)}><Pencil size={14} aria-hidden="true" /> Edit</button>
          <button
            type="button"
            className="button-text"
            onClick={async () => {
              const next = row.status === 'published' ? 'draft' : 'published';
              const { error } = await supabase.from(section.table).update({ status: next }).eq('id', row.id);
              if (error) toast.error(error.message);
              else { toast.success(next === 'published' ? 'Record published.' : 'Record returned to draft.'); load(); }
            }}
          >
            {row.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <button type="button" className="button-text danger" onClick={() => setDeleting(row)}><Trash2 size={14} aria-hidden="true" /> Delete</button>
        </div>
      ),
    },
  ], [key, section.table]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!section) return null;

  return (
    <div className="admin-panel">
      <PageHeader
        eyebrow="CONTENT MANAGEMENT"
        title={section.label}
        description={section.guide?.title}
        actions={<button type="button" className="button" onClick={() => setEditing({})}><Plus size={16} aria-hidden="true" /> New record</button>}
      />
      <GuidePanel {...section.guide} />

      <div className="admin-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder={`Search ${section.label.toLowerCase()}…`} />
        <span className="admin-count">{filtered.length} of {rows.length} records</span>
      </div>

      {loading ? <SkeletonList /> : (
        <DataTable
          columns={columns}
          rows={filtered}
          emptyState={<EmptyState title={`No ${section.label.toLowerCase()} yet`} description="Create the first record to see it here." action={<button type="button" className="button" onClick={() => setEditing({})}><Plus size={16} /> New record</button>} />}
        />
      )}

      <RecordEditor
        section={section}
        record={editing}
        accessToken={accessToken}
        onClose={() => setEditing(null)}
        onSaved={(message) => { setEditing(null); toast.success(message); load(); }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this record?"
        description={`"${deleting?.[key] || 'This record'}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete record"
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          const { error } = await supabase.from(section.table).delete().eq('id', deleting.id);
          setBusy(false);
          setDeleting(null);
          if (error) toast.error(error.message);
          else { toast.success('Record deleted.'); load(); }
        }}
      />
    </div>
  );
}

function RecordEditor({ section, record, accessToken, onClose, onSaved }) {
  const fields = section.fields || [];
  const toast = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    setForm(Object.fromEntries(fields.map((field) => [field, record[field] ?? blankValue(field)])));
  }, [record, fields]);

  if (!record) return null;
  const isNew = !record.id;

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    const payload = { ...form };
    for (const field of NUMBER_FIELDS) {
      if (field in payload) {
        payload[field] = String(payload[field]).trim() === '' ? (field === 'goal_amount' ? null : 0) : Number(payload[field]);
      }
    }
    for (const field of DATETIME_FIELDS) {
      if (field in payload && payload[field] && !String(payload[field]).includes('Z')) {
        const parsed = new Date(payload[field]);
        payload[field] = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }
    }
    const query = isNew
      ? supabase.from(section.table).insert(payload)
      : supabase.from(section.table).update(payload).eq('id', record.id);
    const { error } = await query;
    setSaving(false);
    if (error) toast.error(`The record could not be saved. ${error.message}`);
    else onSaved(isNew ? 'Record created.' : 'Changes saved.');
  }

  return (
    <Modal
      open
      wide
      eyebrow={isNew ? 'NEW RECORD' : 'EDIT RECORD'}
      title={`${isNew ? 'Create' : 'Edit'} ${section.label.replace(/s$/, '').toLowerCase()}`}
      description={section.guide?.note}
      onClose={onClose}
    >
      <form className="admin-form" onSubmit={save}>
        <div className="admin-form-grid">
          {fields.map((field) => (
            <FieldControl
              key={field}
              field={field}
              table={section.table}
              value={form[field]}
              accessToken={accessToken}
              onChange={(value) => setForm((current) => ({ ...current, [field]: value }))}
            />
          ))}
        </div>
        <div className="admin-form-actions">
          <button type="button" className="button button-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create record' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

function FieldControl({ field, table, value, onChange, accessToken }) {
  const toast = useToast();
  const label = FIELD_LABELS[field] || field.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

  if (IMAGE_FIELDS.includes(field)) {
    return (
      <ImageField
        label={label}
        value={value}
        onChange={onChange}
        onUpload={async (file) => {
          try {
            return await uploadImage(file, accessToken);
          } catch (error) {
            toast.error(error.message);
            throw error;
          }
        }}
        hint="Large photographs are stored in the media bucket; smaller images are kept in the database."
      />
    );
  }

  if (CHECK_FIELDS.includes(field)) {
    return (
      <CheckField
        label={label}
        checked={value}
        onChange={onChange}
        hint="Tick only when the signed consent record is on file."
        warning
      />
    );
  }

  if (field === 'status') {
    return <SelectField label={label} value={value || 'draft'} onChange={onChange} options={STATUS_OPTIONS} />;
  }

  if (MULTILINE_FIELDS.includes(field)) {
    return <TextArea label={label} value={value} onChange={onChange} rows={field === 'body' ? 10 : 4} />;
  }

  if (NUMBER_FIELDS.includes(field)) {
    return <TextField label={label} value={value} onChange={onChange} type="number" min="0" step="0.01" hint={field === 'goal_amount' ? 'Leave empty for no fundraising target.' : undefined} />;
  }

  if (DATETIME_FIELDS.includes(field)) {
    return <TextField label={label} value={toLocalInput(value)} onChange={onChange} type="datetime-local" />;
  }

  if (field === 'website' || field.endsWith('_url')) {
    return <TextField label={label} value={value} onChange={onChange} type="url" placeholder="https://" />;
  }

  return <TextField label={label} value={value} onChange={onChange} />;
}
