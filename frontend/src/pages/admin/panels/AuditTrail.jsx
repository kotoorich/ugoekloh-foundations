import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { DataTable, EmptyState, GuidePanel, PageHeader, SearchField, SkeletonList, useToast } from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

export default function AuditTrail() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) toast.error(`The audit trail could not be loaded. ${error.message}`);
      setRows(data || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [rows, search]);

  const columns = [
    { key: 'created_at', label: 'When', render: (row) => new Date(row.created_at).toLocaleString(), sortValue: (row) => new Date(row.created_at).getTime() },
    { key: 'action', label: 'Action', render: (row) => <strong>{(row.action || '').replaceAll('_', ' ')}</strong> },
    { key: 'entity', label: 'Record type', render: (row) => (row.entity || '').replaceAll('_', ' ') },
    { key: 'details', label: 'Details', render: (row) => <code className="cell-code">{JSON.stringify(row.details || {})}</code> },
  ];

  return (
    <div className="admin-panel">
      <PageHeader eyebrow="ACCOUNTABILITY" title="Audit trail" description="A record of significant actions taken in the dashboard." />
      <GuidePanel {...SECTIONS.audit_logs.guide} />
      <div className="admin-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Search the audit trail…" />
        <span className="admin-count">{filtered.length} entries</span>
      </div>
      {loading ? <SkeletonList /> : (
        <DataTable
          columns={columns}
          rows={filtered}
          emptyState={<EmptyState icon={ClipboardList} title="No audit entries" description="Actions will be recorded here automatically." />}
        />
      )}
    </div>
  );
}
