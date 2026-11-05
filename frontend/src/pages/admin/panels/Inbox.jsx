import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase, shortDate } from '../../../lib/supabase';
import { EmptyState, GuidePanel, Modal, PageHeader, SearchField, SelectField, SkeletonList, StatusPill, useToast } from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

const SOURCES = [
  { table: 'contact_messages', key: 'contact', label: 'Messages', title: (row) => row.subject || 'General enquiry', person: (row) => row.name },
  { table: 'volunteer_applications', key: 'volunteer', label: 'Volunteers', title: (row) => row.skills || 'Volunteer application', person: (row) => row.name },
  { table: 'partnership_applications', key: 'partnership', label: 'Partnership enquiries', title: (row) => row.partnership_type || 'Partnership enquiry', person: (row) => row.organization_name || row.contact_name },
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
];

export default function Inbox() {
  const toast = useToast();
  const [source, setSource] = useState('contact');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const current = SOURCES.find((item) => item.key === source);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from(current.table).select('*').order('created_at', { ascending: false }).limit(300);
    if (error) toast.error(`Items could not be loaded. ${error.message}`);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [source]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [rows, search]);

  async function setStatus(row, status) {
    const { error } = await supabase.from(current.table).update({ status }).eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked as ${status.replaceAll('_', ' ')}.`);
    setOpen(null);
    load();
  }

  return (
    <div className="admin-panel">
      <PageHeader
        eyebrow="ENQUIRIES"
        title="Enquiries"
        description="Messages, volunteer applications and partnership enquiries from the public website."
      />
      <GuidePanel {...SECTIONS.inbox.guide} />

      <div className="admin-tabs" role="tablist">
        {SOURCES.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={source === item.key}
            className={source === item.key ? 'admin-tab active' : 'admin-tab'}
            onClick={() => { setSource(item.key); setOpen(null); }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="admin-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Search enquiries…" />
        <span className="admin-count">{filtered.length} items</span>
      </div>

      {loading ? <SkeletonList /> : filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Nothing here yet" description="New enquiries will appear here as soon as they arrive." />
      ) : (
        <ul className="inbox-list">
          {filtered.map((row) => (
            <li key={row.id} className={row.status === 'new' ? 'inbox-item unread' : 'inbox-item'}>
              <button type="button" onClick={() => setOpen(row)}>
                <div className="inbox-main">
                  <strong>{current.title(row)}</strong>
                  <small>{current.person(row) || 'Unknown sender'} · {row.email || ''}</small>
                </div>
                <div className="inbox-meta">
                  <StatusPill status={row.status || 'new'} />
                  <small>{shortDate(row.created_at)}</small>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(open)}
        title={open ? current.title(open) : ''}
        eyebrow="ENQUIRY DETAIL"
        onClose={() => setOpen(null)}
      >
        {open && (
          <div className="inbox-detail">
            <dl className="admin-stat-list">
              <div><dt>From</dt><dd>{current.person(open) || 'Unknown'}</dd></div>
              <div><dt>Email</dt><dd><a href={`mailto:${open.email}`}>{open.email}</a></dd></div>
              {open.phone && <div><dt>Phone</dt><dd>{open.phone}</dd></div>}
              <div><dt>Received</dt><dd>{new Date(open.created_at).toLocaleString()}</dd></div>
            </dl>
            {open.message && <p className="inbox-message">{open.message}</p>}
            <SelectField
              label="Mark as"
              value={open.status || 'new'}
              onChange={(value) => setStatus(open, value)}
              options={STATUS_OPTIONS}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
