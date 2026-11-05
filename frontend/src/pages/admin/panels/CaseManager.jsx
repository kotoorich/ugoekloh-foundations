import React, { useEffect, useMemo, useState } from 'react';
import { Archive, HeartPulse, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { apiUrl, supabase, uploadImage, mediaUrl, money, shortDate } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import {
  CheckField, ConfirmDialog, EmptyState, GuidePanel, ImageField, Modal,
  PageHeader, ProgressBar, SearchField, SelectField, SkeletonList, StatusPill,
  TextArea, TextField, useToast,
} from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

const SUPPORT_CATEGORIES = [
  { value: 'burn_recovery', label: 'Burn recovery' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'medical_support', label: 'Medical support' },
  { value: 'family_support', label: 'Family support' },
  { value: 'education', label: 'Education support' },
];

const CASE_STATUSES = [
  { value: 'under_review', label: 'Under review' },
  { value: 'active', label: 'Active support' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'closed', label: 'Closed' },
];

const ACTIVITY_TYPES = [
  { value: 'case_note', label: 'Case note' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'home_visit', label: 'Home visit' },
  { value: 'status_change', label: 'Status change' },
  { value: 'disbursement', label: 'Disbursement' },
];

const EMPTY_FORM = {
  case_reference: '', guardian_name: '', guardian_contact: '', child_display_name: '',
  support_category: 'burn_recovery', support_summary: '', case_status: 'under_review',
  consent_to_collect: false, consent_to_publish: false, assigned_to: '',
  image_path: '', date_of_birth: '', age_band: '', gender: '', location: '',
  medical_needs: '', rehabilitation_needs: '', support_need: '',
  target_amount: '', funding_source: '', public_display_name: '', public_story: '',
  consent_reference: '', is_critical: false, is_public: false, archived_at: null,
};

export default function CaseManager() {
  const { profile, accessToken } = useAuth();
  const toast = useToast();
  const isAdmin = ['super_admin', 'admin'].includes(profile?.role);
  const [rows, setRows] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [activities, setActivities] = useState({});
  const [funding, setFunding] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    let query = supabase.from('beneficiaries').select('*').order('created_at', { ascending: false }).limit(300);
    query = showArchived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
    const { data, error } = await query;
    if (error) toast.error(`Cases could not be loaded. ${error.message}`);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [showArchived]);

  useEffect(() => {
    if (!isAdmin || !supabase) return;
    supabase.from('staff_profiles').select('user_id,full_name,role').eq('is_active', true).order('full_name')
      .then(({ data }) => setWorkers(data || []));
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      if (!supabase || !rows.length) { setActivities({}); setFunding({}); return; }
      const ids = rows.map((row) => row.id);
      const [activityResult, fundingResult] = await Promise.all([
        supabase.from('beneficiary_case_activities')
          .select('id,beneficiary_id,activity_type,summary,next_follow_up_at,created_at')
          .in('beneficiary_id', ids).order('created_at', { ascending: false }).limit(500),
        supabase.from('case_funding')
          .select('id,beneficiary_id,amount,entry_type,note,created_at')
          .in('beneficiary_id', ids).limit(500),
      ]);
      if (!active) return;
      const grouped = {};
      for (const item of activityResult.data || []) {
        (grouped[item.beneficiary_id] ||= []).push(item);
      }
      const fundingGrouped = {};
      for (const item of fundingResult.data || []) {
        (fundingGrouped[item.beneficiary_id] ||= []).push(item);
      }
      setActivities(grouped);
      setFunding(fundingGrouped);
    }
    loadDetail();
    return () => { active = false; };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [rows, search]);

  async function saveCase(form, existingId) {
    const payload = { ...form };
    if (!payload.assigned_to) delete payload.assigned_to;
    else payload.assigned_at = new Date().toISOString();
    payload.target_amount = String(payload.target_amount).trim() === '' ? null : Number(payload.target_amount);
    for (const field of ['date_of_birth', 'age_band', 'gender', 'location', 'medical_needs',
      'rehabilitation_needs', 'support_need', 'funding_source', 'public_display_name',
      'public_story', 'consent_reference', 'image_path']) {
      if (payload[field] === '') payload[field] = null;
    }
    const { error } = existingId
      ? await supabase.from('beneficiaries').update(payload).eq('id', existingId)
      : await supabase.from('beneficiaries').insert(payload);
    if (error) throw new Error(error.message);
  }

  async function recordFunding(caseId, entryType, amount, note) {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('case_funding').insert({
      beneficiary_id: caseId,
      amount: Number(amount),
      entry_type: entryType,
      note: note || null,
      recorded_by: user?.user?.id,
    });
    if (error) throw new Error(error.message);
  }

  return (
    <div className="admin-panel">
      <PageHeader
        eyebrow="SAFEGUARDING & CASEWORK"
        title={isAdmin ? 'Child cases' : 'My assigned cases'}
        description={isAdmin
          ? 'Register children, record consent, plan support and supervise each case.'
          : 'Only cases assigned to your staff account are shown here.'}
        actions={isAdmin && (
          <button type="button" className="button" onClick={() => setEditing({ ...EMPTY_FORM })}>
            <Plus size={16} aria-hidden="true" /> Register a case
          </button>
        )}
      />
      <GuidePanel {...SECTIONS.beneficiaries.guide} />

      <div className="admin-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Search cases…" />
        <label className="admin-inline-check">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          <span>Show archived cases</span>
        </label>
        <span className="admin-count">{filtered.length} cases</span>
      </div>

      {loading ? <SkeletonList /> : filtered.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title={showArchived ? 'No archived cases' : 'No child cases registered'}
          description={showArchived ? 'Cases you archive will appear here.' : 'Register a case to begin the support process.'}
        />
      ) : (
        <div className="case-grid">
          {filtered.map((row) => {
            const caseFunding = funding[row.id] || [];
            const invested = caseFunding.filter((entry) => entry.entry_type === 'expense').reduce((sum, entry) => sum + Number(entry.amount), 0);
            const received = Number(row.amount_raised || 0);
            const open = expanded === row.id;
            return (
              <article className="case-card" key={row.id}>
                <div className="case-card-head">
                  <div className="case-card-identity">
                    {row.image_path
                      ? <img className="case-thumb" src={mediaUrl(row.image_path)} alt="" />
                      : <span className="case-thumb case-thumb-empty" aria-hidden="true"><HeartPulse size={18} /></span>}
                    <div>
                      <span className="case-reference">{row.case_reference}</span>
                      <h3>{row.child_display_name || 'Confidential child record'}</h3>
                      <p>{(row.support_category || 'Support not categorised').replaceAll('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="case-card-tags">
                    <StatusPill status={row.case_status || 'under_review'} />
                    {row.is_public && <StatusPill status="published" />}
                    {row.is_critical && <span className="case-critical">Critical</span>}
                    {row.archived_at && <StatusPill status="archived" />}
                  </div>
                </div>

                <div className="case-card-body">
                  <dl className="admin-stat-list">
                    <div><dt>Target</dt><dd>{row.target_amount ? money(row.target_amount) : 'Not set'}</dd></div>
                    <div><dt>Received</dt><dd>{money(received)}</dd></div>
                    <div><dt>Invested</dt><dd>{money(invested)}</dd></div>
                  </dl>
                  {Number(row.target_amount) > 0 && (
                    <ProgressBar value={received} target={row.target_amount} label="Donations received toward target" />
                  )}

                  <div className="case-meta">
                    <span>Consent to collect: <strong>{row.consent_to_collect ? 'Yes' : 'No'}</strong></span>
                    <span>Consent to publish: <strong>{row.consent_to_publish ? 'Yes' : 'No'}</strong></span>
                    {row.consent_reference && <span>Consent ref: <strong>{row.consent_reference}</strong></span>}
                    {row.location && <span>Location: <strong>{row.location}</strong></span>}
                  </div>

                  {isAdmin && (
                    <div className="case-actions">
                      <button type="button" className="button-text" onClick={() => setEditing({ ...EMPTY_FORM, ...row, target_amount: row.target_amount ?? '' })}>
                        <Pencil size={14} aria-hidden="true" /> Edit case
                      </button>
                      <SelectField
                        label="Assign to"
                        value={row.assigned_to || ''}
                        options={[{ value: '', label: 'Not assigned' }, ...workers.map((worker) => ({ value: worker.user_id, label: worker.full_name }))]}
                        onChange={async (value) => {
                          try {
                            const { data } = await supabase.auth.getSession();
                            const response = await fetch(`${apiUrl}/api/admin/cases/${encodeURIComponent(row.id)}/assign`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` },
                              body: JSON.stringify({ assigned_to: value || null }),
                            });
                            const payload = await response.json().catch(() => ({}));
                            if (!response.ok) throw new Error(payload.detail || 'The case could not be reassigned.');
                            toast.success(value ? 'Case assigned.' : 'Case unassigned.');
                            load();
                          } catch (error) {
                            toast.error(error.message);
                          }
                        }}
                      />
                      <SelectField
                        label="Case status"
                        value={row.case_status || 'under_review'}
                        options={CASE_STATUSES}
                        onChange={async (value) => {
                          const { error } = await supabase.from('beneficiaries').update({ case_status: value }).eq('id', row.id);
                          if (error) { toast.error(error.message); return; }
                          const { data: user } = await supabase.auth.getUser();
                          await supabase.from('beneficiary_case_activities').insert({
                            beneficiary_id: row.id,
                            activity_type: 'status_change',
                            summary: `Status changed to ${value.replaceAll('_', ' ')}`,
                            recorded_by: user?.user?.id,
                          });
                          toast.success('Case status updated.');
                          load();
                        }}
                      />
                      <button
                        type="button"
                        className="button-text"
                        onClick={async () => {
                          const archive = !row.archived_at;
                          const { error } = await supabase.from('beneficiaries')
                            .update({ archived_at: archive ? new Date().toISOString() : null })
                            .eq('id', row.id);
                          if (error) toast.error(error.message);
                          else { toast.success(archive ? 'Case archived.' : 'Case restored.'); load(); }
                        }}
                      >
                        <Archive size={14} aria-hidden="true" /> {row.archived_at ? 'Restore' : 'Archive'}
                      </button>
                      <button type="button" className="button-text danger" onClick={() => setDeleting(row)}>
                        <Trash2 size={14} aria-hidden="true" /> Delete
                      </button>
                    </div>
                  )}

                  <button type="button" className="button-text case-expand" onClick={() => setExpanded(open ? null : row.id)}>
                    {open ? 'Hide case history and funding' : `Show case history and funding (${(activities[row.id] || []).length})`}
                  </button>

                  {open && (
                    <div className="case-detail">
                      {row.medical_needs && <p><strong>Medical needs:</strong> {row.medical_needs}</p>}
                      {row.rehabilitation_needs && <p><strong>Rehabilitation:</strong> {row.rehabilitation_needs}</p>}
                      {row.support_summary && <p><strong>Support summary:</strong> {row.support_summary}</p>}
                      {row.public_story && <p><strong>Public story:</strong> {row.public_story}</p>}

                      <CaseActivity
                        caseId={row.id}
                        activities={activities[row.id] || []}
                        onAdded={() => { toast.success('Case update recorded.'); load(); }}
                        onError={(message) => toast.error(message)}
                      />

                      <CaseFunding
                        caseId={row.id}
                        entries={caseFunding}
                        onAdded={async (entryType, amount, note) => {
                          try {
                            await recordFunding(row.id, entryType, amount, note);
                            toast.success(entryType === 'expense' ? 'Expense recorded.' : 'Contribution recorded.');
                            load();
                          } catch (error) { toast.error(error.message); }
                        }}
                      />

                      {isAdmin && (
                        <div className="case-files">
                          <strong>Private case documents</strong>
                          <label className="button button-outline button-small">
                            <Upload size={14} aria-hidden="true" /> Upload document
                            <input
                              hidden
                              type="file"
                              accept="application/pdf,image/jpeg,image/png"
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                if (!file) return;
                                if (file.size > 10 * 1024 * 1024) { toast.error('Choose a file under 10 MB.'); return; }
                                const objectPath = `${row.id}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '-')}`;
                                const { error } = await supabase.storage.from('foundation-case-files').upload(objectPath, file, { contentType: file.type });
                                if (error) { toast.error(error.message); return; }
                                await supabase.from('beneficiary_documents').insert({
                                  beneficiary_id: row.id, storage_path: objectPath,
                                  file_name: file.name, mime_type: file.type, byte_size: file.size,
                                });
                                toast.success('Document uploaded.');
                              }}
                            />
                          </label>
                          <small>Documents are stored privately and are never published.</small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CaseEditor
        record={editing}
        accessToken={accessToken}
        workers={workers}
        onClose={() => setEditing(null)}
        onSaved={async (form) => {
          try {
            await saveCase(form, editing?.id);
            setEditing(null);
            toast.success(editing?.id ? 'Case updated.' : 'Case registered.');
            load();
          } catch (error) {
            toast.error(`The case could not be saved. ${error.message}`);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this child case?"
        description="The case, its history and its funding entries will be permanently removed. Archive it instead if you may need it later."
        confirmLabel="Delete case"
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          const { error } = await supabase.from('beneficiaries').delete().eq('id', deleting.id);
          setBusy(false);
          setDeleting(null);
          if (error) toast.error(error.message);
          else { toast.success('Case deleted.'); load(); }
        }}
      />
    </div>
  );
}

function CaseActivity({ caseId, activities, onAdded, onError }) {
  const [summary, setSummary] = useState('');
  const [type, setType] = useState('case_note');
  const [followUp, setFollowUp] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!summary.trim()) { onError('Add a short summary before saving.'); return; }
    setBusy(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('beneficiary_case_activities').insert({
      beneficiary_id: caseId,
      activity_type: type,
      summary: summary.trim(),
      next_follow_up_at: followUp ? new Date(followUp).toISOString() : null,
      recorded_by: user?.user?.id,
    });
    setBusy(false);
    if (error) { onError(error.message); return; }
    setSummary(''); setFollowUp('');
    onAdded();
  }

  return (
    <div className="case-activity">
      <h4>Case history</h4>
      {activities.length === 0
        ? <p className="admin-muted">No updates recorded yet.</p>
        : activities.map((item) => (
          <div className="case-history-item" key={item.id}>
            <div>
              <strong>{(item.activity_type || 'note').replaceAll('_', ' ')}</strong>
              <small>{new Date(item.created_at).toLocaleString()}</small>
            </div>
            <p>{item.summary}</p>
            {item.next_follow_up_at && <small>Next follow-up: {new Date(item.next_follow_up_at).toLocaleString()}</small>}
          </div>
        ))}
      <form className="case-activity-form" onSubmit={submit}>
        <SelectField label="Activity type" value={type} onChange={setType} options={ACTIVITY_TYPES} />
        <TextArea label="What happened" value={summary} onChange={setSummary} rows={2} />
        <TextField label="Next follow-up" type="datetime-local" value={followUp} onChange={setFollowUp} />
        <button className="button button-small" disabled={busy}>{busy ? 'Saving…' : 'Record update'}</button>
      </form>
    </div>
  );
}

function CaseFunding({ entries, onAdded }) {
  const [entryType, setEntryType] = useState('contribution');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const total = entries.reduce((sum, entry) => sum + (entry.entry_type === 'expense' ? -Number(entry.amount) : Number(entry.amount)), 0);

  return (
    <div className="case-funding">
      <h4>Funding ledger</h4>
      <p className="admin-muted">Record what the foundation contributes to or spends on this case.</p>
      {entries.length > 0 && (
        <ul className="case-funding-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span className={entry.entry_type === 'expense' ? 'amount-out' : 'amount-in'}>
                {entry.entry_type === 'expense' ? '−' : '+'}{money(entry.amount)}
              </span>
              <small>{shortDate(entry.created_at)}{entry.note ? ` · ${entry.note}` : ''}</small>
            </li>
          ))}
        </ul>
      )}
      <p className="case-funding-total">Net recorded: <strong>{money(total)}</strong></p>
      <form
        className="case-funding-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!amount || Number(amount) <= 0) return;
          setBusy(true);
          await onAdded(entryType, amount, note);
          setBusy(false);
          setAmount(''); setNote('');
        }}
      >
        <SelectField
          label="Entry type"
          value={entryType}
          onChange={setEntryType}
          options={[{ value: 'contribution', label: 'Contribution to this case' }, { value: 'expense', label: 'Expense paid for this case' }]}
        />
        <TextField label="Amount (GHS)" type="number" min="0" step="0.01" value={amount} onChange={setAmount} />
        <TextField label="Note" value={note} onChange={setNote} placeholder="e.g. surgery deposit" />
        <button className="button button-small" disabled={busy}>{busy ? 'Saving…' : 'Record entry'}</button>
      </form>
    </div>
  );
}

function CaseEditor({ record, workers, accessToken, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(record || EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (record) setForm(record); }, [record]);
  if (!record) return null;

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <Modal
      open
      wide
      eyebrow={record.id ? 'EDIT CONFIDENTIAL RECORD' : 'NEW CONFIDENTIAL RECORD'}
      title={record.id ? 'Edit child case' : 'Register a child case'}
      description="Use a case reference rather than a child’s full name wherever possible."
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!form.consent_to_collect) { toast.error('Confirm guardian consent to collect case information before saving.'); return; }
          if (form.is_public && !form.consent_to_publish) { toast.error('A case cannot be made public without recorded consent to publish.'); return; }
          setSaving(true);
          await onSaved(form);
          setSaving(false);
        }}
      >
        <fieldset className="admin-fieldset">
          <legend>Case record</legend>
          <div className="admin-form-grid">
            <TextField label="Case reference" value={form.case_reference} onChange={set('case_reference')} required hint="An internal code, for example UEKF-2026-014." />
            <TextField label="Child display name" value={form.child_display_name} onChange={set('child_display_name')} hint="A first name or initials only." />
            <SelectField label="Support category" value={form.support_category} onChange={set('support_category')} options={SUPPORT_CATEGORIES} />
            <SelectField label="Case status" value={form.case_status} onChange={set('case_status')} options={CASE_STATUSES} />
            <TextField label="Date of birth" type="date" value={form.date_of_birth || ''} onChange={set('date_of_birth')} />
            <TextField label="Age band" value={form.age_band} onChange={set('age_band')} placeholder="e.g. 5-8 years" />
            <TextField label="Gender" value={form.gender} onChange={set('gender')} />
            <TextField label="General location" value={form.location} onChange={set('location')} hint="Region or district only, never a street address." />
          </div>
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Guardian</legend>
          <div className="admin-form-grid">
            <TextField label="Guardian name" value={form.guardian_name} onChange={set('guardian_name')} required />
            <TextField label="Guardian contact" value={form.guardian_contact} onChange={set('guardian_contact')} required />
          </div>
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Support and medical</legend>
          <div className="admin-form-grid">
            <TextArea label="Support summary" value={form.support_summary} onChange={set('support_summary')} rows={3} />
            <TextArea label="Medical needs" value={form.medical_needs} onChange={set('medical_needs')} rows={3} />
            <TextArea label="Rehabilitation needs" value={form.rehabilitation_needs} onChange={set('rehabilitation_needs')} rows={3} />
          </div>
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Funding</legend>
          <div className="admin-form-grid">
            <TextArea label="Support need (public wording)" value={form.support_need} onChange={set('support_need')} rows={2} hint="A short description that is safe to show publicly." />
            <TextField label="Target amount (GHS)" type="number" min="0" step="0.01" value={form.target_amount ?? ''} onChange={set('target_amount')} />
            <TextField label="Funding source" value={form.funding_source} onChange={set('funding_source')} hint="For example foundation funds, a donor or a partner." />
          </div>
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Case image</legend>
          <ImageField
            label="Case photograph"
            value={form.image_path}
            onChange={set('image_path')}
            onUpload={async (file) => {
              try { return await uploadImage(file, accessToken); }
              catch (error) { toast.error(error.message); throw error; }
            }}
            hint="Held privately unless the case is published. Never upload a photograph without guardian consent."
          />
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Consent and visibility</legend>
          <CheckField label="Consent to collect case information" checked={form.consent_to_collect} onChange={set('consent_to_collect')} hint="Required before any case can be saved." />
          <CheckField label="Consent to publish" checked={form.consent_to_publish} onChange={set('consent_to_publish')} hint="Only tick when the guardian has signed a consent-to-publish record." warning />
          <div className="admin-form-grid">
            <TextField label="Consent reference" value={form.consent_reference} onChange={set('consent_reference')} hint="The reference of the signed consent form." />
            <TextField label="Public display name" value={form.public_display_name} onChange={set('public_display_name')} hint="Shown publicly instead of the child’s name." />
          </div>
          <TextArea label="Public story" value={form.public_story} onChange={set('public_story')} rows={3} hint="Written for donors. Never include medical detail or family names." />
          <CheckField label="Mark as critical" checked={form.is_critical} onChange={set('is_critical')} hint="Critical cases are shown first to donors." />
          <CheckField label="Show publicly and allow donations to this child" checked={form.is_public} onChange={set('is_public')} hint="Requires consent to publish. Leave off to keep the case private." warning />
          {form.is_public && !form.consent_to_publish && (
            <p className="field-error" role="alert">Consent to publish must be recorded before this case can be made public.</p>
          )}
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Case worker</legend>
          <SelectField
            label="Assigned to"
            value={form.assigned_to || ''}
            onChange={set('assigned_to')}
            options={[{ value: '', label: 'Not assigned' }, ...workers.map((worker) => ({ value: worker.user_id, label: `${worker.full_name} — ${(worker.role || '').replaceAll('_', ' ')}` }))]}
          />
        </fieldset>

        <div className="admin-form-actions">
          <button type="button" className="button button-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button" disabled={saving}>{saving ? 'Saving…' : record.id ? 'Save changes' : 'Register case'}</button>
        </div>
      </form>
    </Modal>
  );
}
