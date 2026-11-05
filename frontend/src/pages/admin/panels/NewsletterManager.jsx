import React, { useEffect, useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import { supabase, shortDate } from '../../../lib/supabase';
import { DataTable, EmptyState, GuidePanel, PageHeader, SearchField, SkeletonList, StatusPill, useToast } from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

export default function NewsletterManager() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) toast.error(`Subscribers could not be loaded. ${error.message}`);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => `${row.email || ''} ${row.status || ''}`.toLowerCase().includes(needle));
  }, [rows, search]);

  const columns = [
    { key: 'email', label: 'Email address', render: (row) => <strong>{row.email}</strong> },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'created_at', label: 'Subscribed', render: (row) => shortDate(row.created_at), sortValue: (row) => new Date(row.created_at).getTime() },
    {
      key: 'actions', label: 'Actions', sortable: false, align: 'right',
      render: (row) => (
        <button
          type="button"
          className="button-text"
          onClick={async () => {
            const next = row.status === 'subscribed' ? 'unsubscribed' : 'subscribed';
            const { error } = await supabase.from('newsletter_subscribers').update({ status: next }).eq('id', row.id);
            if (error) toast.error(error.message);
            else { toast.success(next === 'subscribed' ? 'Subscriber reactivated.' : 'Subscriber unsubscribed.'); load(); }
          }}
        >
          {row.status === 'subscribed' ? 'Unsubscribe' : 'Reactivate'}
        </button>
      ),
    },
  ];

  return (
    <div className="admin-panel">
      <PageHeader eyebrow="AUDIENCE" title="Newsletter" description="People who asked to hear from the foundation." />
      <GuidePanel {...SECTIONS.newsletter.guide} />
      <div className="admin-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Search subscribers…" />
        <span className="admin-count">{filtered.length} subscribers</span>
      </div>
      {loading ? <SkeletonList /> : (
        <DataTable
          columns={columns}
          rows={filtered}
          emptyState={<EmptyState icon={Mail} title="No subscribers yet" description="People who sign up on the public site will appear here." />}
        />
      )}
    </div>
  );
}
