import React, { useEffect, useMemo, useState } from 'react';
import { Download, Wallet } from 'lucide-react';
import { supabase, money, shortDate } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import {
  ConfirmDialog, DataTable, EmptyState, GuidePanel, PageHeader, SearchField,
  SelectField, SkeletonList, StatusPill, useToast,
} from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

export default function DonationLedger() {
  const { role, accessToken } = useAuth();
  const toast = useToast();
  const isAdmin = ['super_admin', 'admin'].includes(role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [refunding, setRefunding] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('donations')
      .select('id,reference,donor_name,donor_email,donor_phone,amount,currency,status,payment_method,created_at,refund_status')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) toast.error(`Donations could not be loaded. ${error.message}`);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (!needle) return true;
      return `${row.donor_name || ''} ${row.donor_email || ''} ${row.reference || ''}`.toLowerCase().includes(needle);
    });
  }, [rows, status, search]);

  const paidTotal = useMemo(
    () => rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows],
  );

  function exportCsv() {
    const header = ['Reference', 'Date', 'Donor', 'Email', 'Phone', 'Amount', 'Currency', 'Status', 'Method'];
    const lines = filtered.map((row) => [
      row.reference, row.created_at, row.donor_name, row.donor_email, row.donor_phone,
      row.amount, row.currency, row.status, row.payment_method,
    ]);
    const csv = [header, ...lines]
      .map((line) => line.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ugoekloh-donations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`${filtered.length} donations exported.`);
  }

  const columns = [
    { key: 'reference', label: 'Reference', render: (row) => <code className="cell-code">{row.reference}</code> },
    { key: 'created_at', label: 'Date', render: (row) => shortDate(row.created_at), sortValue: (row) => new Date(row.created_at).getTime() },
    {
      key: 'donor_name',
      label: 'Donor',
      render: (row) => <div className="cell-primary"><strong>{row.donor_name || 'Anonymous'}</strong><small>{row.donor_email}</small></div>,
    },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => money(row.amount), sortValue: (row) => Number(row.amount) },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.refund_status === 'processed' ? 'refunded' : row.status} /> },
    ...(isAdmin ? [{
      key: 'actions', label: 'Actions', sortable: false, align: 'right',
      render: (row) => (
        row.status === 'paid' && !row.refund_status
          ? <button type="button" className="button-text danger" onClick={() => setRefunding(row)}>Refund</button>
          : <span className="admin-muted">—</span>
      ),
    }] : []),
  ];

  return (
    <div className="admin-panel">
      <PageHeader
        eyebrow="DONATION LEDGER"
        title="Donations"
        description="Every donation received through the public website."
        actions={<button type="button" className="button button-outline" onClick={exportCsv} disabled={!filtered.length}><Download size={16} aria-hidden="true" /> Export CSV</button>}
      />
      <GuidePanel {...SECTIONS.donations.guide} />

      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Verified income</span>
          <strong className="stat-value">{money(paidTotal)}</strong>
          <span className="stat-hint">{rows.filter((row) => row.status === 'paid').length} paid donations</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Showing</span>
          <strong className="stat-value">{filtered.length}</strong>
          <span className="stat-hint">of {rows.length} records</span>
        </div>
      </section>

      <div className="admin-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Search by donor, email or reference…" />
        <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_FILTERS} />
      </div>

      {loading ? <SkeletonList /> : (
        <DataTable
          columns={columns}
          rows={filtered}
          emptyState={<EmptyState icon={Wallet} title="No donations found" description="Adjust the filters, or wait for the first donation to arrive." />}
        />
      )}

      <ConfirmDialog
        open={Boolean(refunding)}
        title="Refund this donation?"
        description={`${money(refunding?.amount)} will be refunded to the donor through Paystack and the donation will be marked refunded. This cannot be undone.`}
        confirmLabel="Send refund"
        busy={busy}
        onCancel={() => setRefunding(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            const { data } = await supabase.auth.getSession();
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/donations/${encodeURIComponent(refunding.reference)}/refund`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${data.session?.access_token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.detail || 'The refund could not be started.');
            toast.success(payload.message || 'Refund submitted to Paystack.');
            setRefunding(null);
            load();
          } catch (error) {
            toast.error(error.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
