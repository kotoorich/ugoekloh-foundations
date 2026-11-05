import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, HeartPulse, MessageSquare, PiggyBank, Users } from 'lucide-react';
import { apiFetch, supabase, money, shortDate } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { GuidePanel, PageHeader, ProgressBar, Spinner, StatCard } from '../../../components/AdminUI';
import { SECTIONS } from '../modules';

/** Group paid donations into weekly buckets across a window of days. */
function bucketByWeek(donations, days = 90, buckets = 7) {
  const span = Math.ceil(days / buckets);
  const now = Date.now();
  const start = now - days * 24 * 60 * 60 * 1000;
  return Array.from({ length: buckets }, (_, index) => {
    const from = start + index * span * 24 * 60 * 60 * 1000;
    const to = from + span * 24 * 60 * 60 * 1000;
    const total = donations
      .filter((row) => {
        const at = new Date(row.created_at).getTime();
        return at >= from && at < to;
      })
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { label: shortDate(new Date(from).toISOString()), total };
  });
}

export default function Dashboard() {
  const { role, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState([]);
  const [counts, setCounts] = useState({ programmes: 0, cases: 0, enquiries: 0 });
  const [funds, setFunds] = useState(null);

  const canSee = (key) => Boolean(SECTIONS[key]?.roles.includes(role));

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      setLoading(true);
      const tasks = [];
      if (canSee('donations')) {
        tasks.push(supabase.from('donations').select('amount,created_at,status').eq('status', 'paid').order('created_at', { ascending: false }).limit(1000));
      }
      if (canSee('programmes')) {
        tasks.push(supabase.from('programmes').select('id', { count: 'exact', head: true }).eq('status', 'published'));
      }
      if (canSee('beneficiaries')) {
        tasks.push(supabase.from('beneficiaries').select('id', { count: 'exact', head: true }).is('archived_at', null));
      }
      if (canSee('inbox')) {
        tasks.push(supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'));
      }
      const results = await Promise.all(tasks);
      if (!active) return;
      let index = 0;
      let paid = [];
      const next = { programmes: 0, cases: 0, enquiries: 0 };
      if (canSee('donations')) { paid = results[index++]?.data || []; }
      if (canSee('programmes')) { next.programmes = results[index++]?.count || 0; }
      if (canSee('beneficiaries')) { next.cases = results[index++]?.count || 0; }
      if (canSee('inbox')) { next.enquiries = results[index++]?.count || 0; }
      setDonations(paid);
      setCounts(next);
      setLoading(false);
    }
    load();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    let active = true;
    if (!canSee('allocations')) return undefined;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const summary = await apiFetch('/api/admin/funds/summary', data.session?.access_token);
        if (active) setFunds(summary);
      } catch {
        if (active) setFunds(null);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const weekly = useMemo(() => bucketByWeek(donations, 90, 7), [donations]);
  const max = Math.max(1, ...weekly.map((bucket) => bucket.total));
  const raised = donations.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const recent = donations.slice(0, 5);

  return (
    <div className="admin-panel">
      <PageHeader
        eyebrow="FOUNDATION OVERVIEW"
        title={`Welcome back, ${(profile?.full_name || 'Administrator').split(' ')[0]}`}
        description="A summary of foundation activity. Only the areas your role can access are counted here."
      />
      <GuidePanel {...SECTIONS.dashboard.guide} />

      {loading ? <Spinner label="Loading your overview…" /> : (
        <>
          <section className="stat-grid">
            {canSee('donations') && (
              <StatCard icon={Banknote} label="Funds received" value={money(raised)} hint={`${donations.length} verified donations`} />
            )}
            {funds && (
              <StatCard icon={PiggyBank} label="Available to allocate" value={money(funds.unallocated)} hint={`${money(funds.total_allocated)} already directed`} />
            )}
            {canSee('programmes') && <StatCard icon={Users} label="Published programmes" value={counts.programmes} hint="Visible to donors" />}
            {canSee('beneficiaries') && <StatCard icon={HeartPulse} label="Active child cases" value={counts.cases} hint="Confidential records" />}
            {canSee('inbox') && <StatCard icon={MessageSquare} label="New enquiries" value={counts.enquiries} hint="Messages awaiting a reply" />}
          </section>

          <div className="dashboard-columns">
            {canSee('donations') && (
              <section className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <h2>Donation activity</h2>
                    <p>Verified income over the last 90 days, grouped weekly.</p>
                  </div>
                  <Link className="button-text" to="/admin/donations">View donations</Link>
                </div>
                <div className="bar-chart" role="img" aria-label="Donation totals for each of the last seven weeks">
                  {weekly.map((bucket) => (
                    <div className="bar-chart-column" key={bucket.label}>
                      <span className="bar-chart-value">{bucket.total > 0 ? money(bucket.total).replace('GHS ', '') : ''}</span>
                      <span className="bar-chart-bar" style={{ height: `${Math.max(3, (bucket.total / max) * 100)}%` }} />
                      <span className="bar-chart-label">{bucket.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {canSee('donations') && (
              <section className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <h2>Recent donations</h2>
                    <p>The latest verified gifts.</p>
                  </div>
                </div>
                {recent.length === 0 ? (
                  <p className="admin-muted">No verified donations have been recorded yet.</p>
                ) : (
                  <ul className="admin-activity-list">
                    {recent.map((row, index) => (
                      <li key={`${row.created_at}-${index}`}>
                        <strong>{money(row.amount)}</strong>
                        <span>{shortDate(row.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {funds && (
              <section className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <h2>Allocation position</h2>
                    <p>How much of the money received has been directed.</p>
                  </div>
                  <Link className="button-text" to="/admin/allocations">Manage allocations</Link>
                </div>
                <ProgressBar value={funds.total_allocated} target={funds.total_received} label="Allocated of received" />
                <dl className="admin-stat-list">
                  <div><dt>Received</dt><dd>{money(funds.total_received)}</dd></div>
                  <div><dt>Allocated</dt><dd>{money(funds.total_allocated)}</dd></div>
                  <div><dt>Available</dt><dd>{money(funds.unallocated)}</dd></div>
                </dl>
              </section>
            )}
          </div>

          <section className="admin-card">
            <div className="admin-card-head">
              <div>
                <h2>Quick access</h2>
                <p>Jump straight to an area you manage.</p>
              </div>
            </div>
            <div className="quick-grid">
              {Object.entries(SECTIONS)
                .filter(([key, section]) => key !== 'dashboard' && section.roles.includes(role))
                .map(([key, section]) => {
                  const Icon = section.icon;
                  return (
                    <Link className="quick-link" to={key === 'dashboard' ? '/admin' : `/admin/${key}`} key={key}>
                      <Icon size={18} aria-hidden="true" />
                      <span>{section.label}</span>
                    </Link>
                  );
                })}
            </div>
          </section>

          <div className="admin-notice admin-notice-warning">
            <strong>Child safeguarding reminder</strong>
            <span>Keep child identities and case details confidential. Publish a child’s story or photograph only with documented guardian consent and safeguarding approval.</span>
          </div>
        </>
      )}
    </div>
  );
}
