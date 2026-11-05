import React, { useEffect, useMemo, useState } from 'react';
import { PiggyBank, Plus, Trash2 } from 'lucide-react';
import { supabase, apiFetch, money, shortDate } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import {
  ConfirmDialog, DataTable, EmptyState, GuidePanel, PageHeader, ProgressBar,
  SelectField, SkeletonList, StatCard, TextArea, TextField, useToast,
} from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

const DESTINATIONS = [
  { value: 'programme', label: 'A programme' },
  { value: 'beneficiary', label: 'A child case' },
  { value: 'general', label: 'General foundation support' },
];

export default function Allocations() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [form, setForm] = useState({ destination_type: 'programme', destination_id: '', amount: '', note: '' });

  async function load() {
    setLoading(true);
    try {
      const [allocationData, programmeData, caseData] = await Promise.all([
        apiFetch('/api/admin/allocations', accessToken),
        supabase.from('programmes').select('id,title').order('title'),
        supabase.from('beneficiaries').select('id,case_reference,child_display_name').is('archived_at', null).order('case_reference'),
      ]);
      setItems(allocationData.items || []);
      setSummary(allocationData.summary || null);
      setProgrammes(programmeData.data || []);
      setCases(caseData.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const destinationOptions = useMemo(() => {
    if (form.destination_type === 'programme') return programmes.map((row) => ({ value: row.id, label: row.title }));
    if (form.destination_type === 'beneficiary') {
      return cases.map((row) => ({ value: row.id, label: `${row.case_reference} — ${row.child_display_name || 'confidential'}` }));
    }
    return [{ value: '', label: 'General support needs no further choice' }];
  }, [form.destination_type, programmes, cases]);

  const columns = [
    { key: 'created_at', label: 'Date', render: (row) => shortDate(row.created_at), sortValue: (row) => new Date(row.created_at).getTime() },
    { key: 'destination_label', label: 'Directed to', render: (row) => <div className="cell-primary"><strong>{row.destination_label}</strong><small>{(row.destination_type || '').replaceAll('_', ' ')}</small></div> },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => money(row.amount), sortValue: (row) => Number(row.amount) },
    { key: 'note', label: 'Note', render: (row) => row.note || '—' },
    {
      key: 'actions', label: 'Actions', sortable: false, align: 'right',
      render: (row) => (
        <button type="button" className="button-text danger" onClick={() => setRemoving(row)}>
          <Trash2 size={14} aria-hidden="true" /> Reverse
        </button>
      ),
    },
  ];

  return (
    <div className="admin-panel">
      <PageHeader
        eyebrow="FUND MANAGEMENT"
        title="Allocations"
        description="Record where money that has already been received has been directed."
      />
      <GuidePanel {...SECTIONS.allocations.guide} />

      {summary && (
        <section className="stat-grid">
          <StatCard icon={PiggyBank} label="Received" value={money(summary.total_received)} hint="Verified paid donations" />
          <StatCard icon={PiggyBank} label="Allocated" value={money(summary.total_allocated)} hint={`${items.length} allocations recorded`} />
          <StatCard icon={PiggyBank} label="Available" value={money(summary.unallocated)} hint="Can still be assigned" />
        </section>
      )}

      {summary && summary.total_received > 0 && (
        <section className="admin-card">
          <ProgressBar value={summary.total_allocated} target={summary.total_received} label="Allocated of received" />
        </section>
      )}

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Record an allocation</h2>
            <p>No payment happens here. You are recording a decision about money already received.</p>
          </div>
        </div>
        <form
          className="admin-form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter an amount greater than zero.'); return; }
            if (form.destination_type !== 'general' && !form.destination_id) { toast.error('Choose what this money is for.'); return; }
            setBusy(true);
            try {
              const result = await apiFetch('/api/admin/allocations', accessToken, {
                method: 'POST',
                body: JSON.stringify({
                  destination_type: form.destination_type,
                  destination_id: form.destination_type === 'general' ? null : form.destination_id,
                  amount: Number(form.amount),
                  note: form.note || null,
                }),
              });
              setSummary(result.summary);
              setForm({ destination_type: 'programme', destination_id: '', amount: '', note: '' });
              toast.success('Allocation recorded.');
              load();
            } catch (error) {
              toast.error(error.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <SelectField
            label="Direct this money to"
            value={form.destination_type}
            onChange={(value) => setForm((current) => ({ ...current, destination_type: value, destination_id: '' }))}
            options={DESTINATIONS}
          />
          {form.destination_type !== 'general' && (
            <SelectField
              label={form.destination_type === 'programme' ? 'Which programme' : 'Which child case'}
              value={form.destination_id}
              onChange={(value) => setForm((current) => ({ ...current, destination_id: value }))}
              options={[{ value: '', label: 'Choose one…' }, ...destinationOptions]}
            />
          )}
          <TextField label="Amount (GHS)" type="number" min="0" step="0.01" value={form.amount} onChange={(value) => setForm((current) => ({ ...current, amount: value }))} />
          <TextArea label="Reason for this allocation" value={form.note} onChange={(value) => setForm((current) => ({ ...current, note: value }))} rows={2} />
          <div className="admin-form-actions">
            <button className="button" disabled={busy}><Plus size={16} aria-hidden="true" /> {busy ? 'Recording…' : 'Record allocation'}</button>
          </div>
        </form>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Allocation history</h2>
            <p>Every allocation, newest first. Reversing an entry returns the money to the available balance.</p>
          </div>
        </div>
        {loading ? <SkeletonList /> : (
          <DataTable
            columns={columns}
            rows={items}
            emptyState={<EmptyState icon={PiggyBank} title="Nothing allocated yet" description="Record an allocation above to direct received money." />}
          />
        )}
      </section>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Reverse this allocation?"
        description={`${money(removing?.amount)} will return to the available balance and the entry will be removed from the ledger. The reversal is written to the audit trail.`}
        confirmLabel="Reverse allocation"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          try {
            const result = await apiFetch(`/api/admin/allocations/${removing.id}`, accessToken, { method: 'DELETE' });
            setSummary(result.summary);
            setRemoving(null);
            toast.success('Allocation reversed.');
            load();
          } catch (error) {
            toast.error(error.message);
          }
        }}
      />
    </div>
  );
}
