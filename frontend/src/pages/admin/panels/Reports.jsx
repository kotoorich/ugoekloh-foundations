import React, { useEffect, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { apiFetch, money, shortDate } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { GuidePanel, PageHeader, ProgressBar, SkeletonList, StatCard, TextField, useToast } from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

function firstOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DESTINATION_LABELS = {
  programme: 'Programmes',
  beneficiary: 'Child cases',
  project: 'Projects',
  general: 'General support',
};

export default function Reports() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const [range, setRange] = useState({ start: firstOfMonth(), end: today() });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const query = new URLSearchParams({ start: range.start, end: range.end }).toString();
      const result = await apiFetch(`/api/admin/reports/summary?${query}`, accessToken);
      setData(result);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range.start, range.end]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ['Ugoekloh Foundations financial summary'],
      ['Period', `${range.start} to ${range.end}`],
      [],
      ['Metric', 'Amount (GHS)'],
      ['Donations received', data.donations.received.toFixed(2)],
      ['Donations directed to programmes', data.donations.programme_directed.toFixed(2)],
      ['Donations directed to child cases', data.donations.case_directed.toFixed(2)],
      ['General donations', data.donations.general.toFixed(2)],
      [],
      ['Total allocated', data.allocations.allocated.toFixed(2)],
      ['Unallocated balance', data.allocations.unallocated.toFixed(2)],
      [],
      ['Allocated by destination', 'Amount (GHS)'],
      ...Object.entries(data.allocations.by_destination).map(([key, value]) => [DESTINATION_LABELS[key] || key, value.toFixed(2)]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ugoekloh-financial-summary-${range.start}-to-${range.end}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Report exported.');
  }

  return (
    <div className="admin-panel">
      <PageHeader
        eyebrow="FINANCIAL REPORTING"
        title="Reports"
        description="Money received, money directed and what remains available."
        actions={<button type="button" className="button button-outline" onClick={exportCsv} disabled={!data}><Download size={16} aria-hidden="true" /> Export CSV</button>}
      />
      <GuidePanel {...SECTIONS.reports.guide} />

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Reporting period</h2>
            <p>Choose the dates to report on. The report updates as soon as you change them.</p>
          </div>
        </div>
        <div className="admin-form-grid">
          <TextField label="From" type="date" value={range.start} onChange={(value) => setRange((current) => ({ ...current, start: value }))} />
          <TextField label="To" type="date" value={range.end} onChange={(value) => setRange((current) => ({ ...current, end: value }))} />
        </div>
      </section>

      {loading ? <SkeletonList /> : !data ? (
        <p className="admin-muted">The report could not be loaded. Check the period and try again.</p>
      ) : (
        <>
          <section className="stat-grid">
            <StatCard icon={BarChart3} label="Received" value={money(data.donations.received)} hint={`${data.donations.count} verified donations`} />
            <StatCard icon={BarChart3} label="Allocated" value={money(data.allocations.allocated)} hint={`${data.allocations.count} allocations`} />
            <StatCard icon={BarChart3} label="Unallocated" value={money(data.allocations.unallocated)} hint="Still available to direct" />
          </section>

          <div className="dashboard-columns">
            <section className="admin-card">
              <div className="admin-card-head">
                <div>
                  <h2>Where donations were directed</h2>
                  <p>Donor choices during the selected period.</p>
                </div>
              </div>
              <dl className="admin-stat-list">
                <div><dt>Programmes</dt><dd>{money(data.donations.programme_directed)}</dd></div>
                <div><dt>Child cases</dt><dd>{money(data.donations.case_directed)}</dd></div>
                <div><dt>General support</dt><dd>{money(data.donations.general)}</dd></div>
                <div><dt>Pending payments</dt><dd>{data.donations.pending}</dd></div>
              </dl>
            </section>

            <section className="admin-card">
              <div className="admin-card-head">
                <div>
                  <h2>How funds were allocated</h2>
                  <p>Internal direction of received money.</p>
                </div>
              </div>
              {Object.keys(data.allocations.by_destination).length === 0 ? (
                <p className="admin-muted">Nothing was allocated during this period.</p>
              ) : (
                <dl className="admin-stat-list">
                  {Object.entries(data.allocations.by_destination).map(([key, value]) => (
                    <div key={key}><dt>{DESTINATION_LABELS[key] || key}</dt><dd>{money(value)}</dd></div>
                  ))}
                </dl>
              )}
            </section>
          </div>

          <section className="admin-card">
            <div className="admin-card-head">
              <div>
                <h2>Allocation position</h2>
                <p>Received compared with what has been directed.</p>
              </div>
            </div>
            <ProgressBar value={data.allocations.allocated} target={data.donations.received} label="Allocated of received" />
            <p className="admin-muted">
              Period: {shortDate(range.start)} to {shortDate(range.end)}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
