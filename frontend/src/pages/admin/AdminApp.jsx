import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Bell, ChevronDown, KeyRound, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { apiUrl, isConfigured, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { ToastProvider, useToast } from '../../components/AdminUI';
import { SECTIONS, ROLE_LABELS, sectionsForRole } from './modules';
import Dashboard from './panels/Dashboard';
import ContentPanel from './panels/ContentPanel';
import CaseManager from './panels/CaseManager';
import DonationLedger from './panels/DonationLedger';
import Allocations from './panels/Allocations';
import Reports from './panels/Reports';
import Inbox from './panels/Inbox';
import StaffManager from './panels/StaffManager';
import FoundationSettings from './panels/FoundationSettings';
import EmailDelivery from './panels/EmailDelivery';
import NewsletterManager from './panels/NewsletterManager';
import AuditTrail from './panels/AuditTrail';

function BrandMark({ size = 34 }) {
  return <img className="admin-logo" src="/logo.svg" alt="" width={size} height={size} aria-hidden="true" />;
}

/* ------------------------------------------------------------- sign in --- */

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError('Those sign-in details were not accepted. Check your email and password.');
      return;
    }
    navigate('/admin', { replace: true });
  }

  return (
    <div className="admin-signin">
      <div className="admin-signin-card">
        <div className="admin-signin-brand">
          <BrandMark size={44} />
          <div>
            <strong>Ugoekloh Foundations</strong>
            <small>Staff administration portal</small>
          </div>
        </div>
        <span className="admin-eyebrow">SECURE STAFF ACCESS</span>
        <h1>Sign in to continue</h1>
        <p className="admin-signin-note">Accounts are created by a super administrator. Public registration is disabled.</p>
        <form onSubmit={submit}>
          <label className="admin-field">
            <span>Work email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@ugoeklohfoundation.org" />
          </label>
          <label className="admin-field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="button button-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="admin-signin-foot">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>Child case information is confidential. Do not share your sign-in details.</span>
        </p>
        <Link className="button-text" to="/">Return to the public website</Link>
      </div>
    </div>
  );
}

/* --------------------------------------------------- forced password set -- */

function PasswordGate() {
  const { session, refreshProfile, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    if (password.length < 12) { setError('Use at least 12 characters.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/api/account/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ new_password: password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'The password could not be updated.');
      await refreshProfile();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-signin">
      <div className="admin-signin-card">
        <div className="admin-signin-brand">
          <BrandMark size={44} />
          <div>
            <strong>Ugoekloh Foundations</strong>
            <small>Staff administration portal</small>
          </div>
        </div>
        <span className="admin-eyebrow">ACCOUNT SECURITY</span>
        <h1>Set your own password</h1>
        <p className="admin-signin-note">You were given a temporary password. Choose a new one before continuing. Use at least 12 characters.</p>
        <form onSubmit={submit}>
          <label className="admin-field">
            <span>New password</span>
            <input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="admin-field">
            <span>Confirm new password</span>
            <input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="button button-full" disabled={busy}>{busy ? 'Updating…' : 'Update password and continue'}</button>
        </form>
        <button type="button" className="button-text" onClick={signOut}>Sign out instead</button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- shell --- */

function NoAccess({ section, role }) {
  return (
    <div className="admin-panel">
      <div className="admin-empty">
        <span className="admin-empty-icon"><ShieldCheck size={26} aria-hidden="true" /></span>
        <h3>You do not have access to {section}</h3>
        <p>
          Your role is {ROLE_LABELS[role] || role}. Ask a super administrator to
          grant access if you need to work in this area.
        </p>
        <Link className="button" to="/admin">Back to dashboard</Link>
      </div>
    </div>
  );
}

function Shell() {
  const { profile, role, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { section: sectionParam } = useParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const navigation = useMemo(() => sectionsForRole(role), [role]);
  const sectionKey = sectionParam && SECTIONS[sectionParam] && navigation.some(([key]) => key === sectionParam)
    ? sectionParam
    : 'dashboard';
  const activeSection = SECTIONS[sectionKey];

  // The sidebar only lists sections a role may use, but nothing stopped someone
  // typing an admin-only URL. Resolve the section against the role's own
  // navigation and show a clear refusal instead of rendering a screen the
  // database would reject anyway.
  const guarded = (key, element) => {
    const allowed = navigation.some(([navKey]) => navKey === key);
    return allowed ? element : <NoAccess section={SECTIONS[key]?.label || key} role={role} />;
  };

  useEffect(() => { setDrawerOpen(false); setMenuOpen(false); }, [sectionKey]);

  useEffect(() => {
    if (sectionParam && sectionParam !== sectionKey) navigate('/admin', { replace: true });
  }, [sectionParam, sectionKey, navigate]);

  // Count of unanswered enquiries, shown as a badge on the topbar bell. Staff
  // without inbox access see no badge rather than a misleading zero.
  const [pendingCount, setPendingCount] = useState(0);
  const canSeeInbox = navigation.some(([key]) => key === 'inbox');

  useEffect(() => {
    if (!canSeeInbox || !supabase) return undefined;
    let active = true;
    async function countPending() {
      const open = ['new', 'unread', 'pending', 'in_review', 'submitted'];
      const tables = ['contact_messages', 'volunteer_applications', 'partnership_applications'];
      const results = await Promise.all(tables.map((table) =>
        supabase.from(table).select('id', { count: 'exact', head: true }).in('status', open)));
      if (!active) return;
      setPendingCount(results.reduce((sum, result) => sum + (result.count || 0), 0));
    }
    countPending();
    const timer = setInterval(countPending, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [canSeeInbox, sectionKey]);

  async function handleSignOut() {
    await signOut();
    toast.info('You have been signed out.');
    navigate('/', { replace: true });
  }

  return (
    <div className="admin-shell">
      <aside className={drawerOpen ? 'admin-sidebar open' : 'admin-sidebar'} aria-label="Administration sections">
        <div className="admin-sidebar-top">
          <Link className="admin-sidebar-brand" to="/admin" onClick={() => setDrawerOpen(false)}>
            <BrandMark />
            <span>
              <strong>Ugoekloh</strong>
              <small>Foundations</small>
            </span>
          </Link>
          <button type="button" className="admin-icon-button admin-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <nav className="admin-nav">
          {navigation.map(([key, section]) => {
            const Icon = section.icon;
            return (
              <NavLink
                key={key}
                to={key === 'dashboard' ? '/admin' : `/admin/${key}`}
                className={({ isActive }) => (isActive || sectionKey === key ? 'admin-nav-item active' : 'admin-nav-item')}
                onClick={() => setDrawerOpen(false)}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{section.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="admin-sidebar-foot">
          <span className="admin-role-badge">{ROLE_LABELS[role] || role}</span>
          <Link className="admin-sidebar-link" to="/">View public website</Link>
        </div>
      </aside>

      {drawerOpen && <div className="admin-drawer-scrim" onClick={() => setDrawerOpen(false)} role="presentation" />}

      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="admin-icon-button admin-burger" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" aria-expanded={drawerOpen}>
            <Menu size={20} />
          </button>
          <div className="admin-topbar-title">
            <span className="admin-eyebrow">ADMINISTRATION</span>
            <h1>{activeSection?.label || 'Dashboard'}</h1>
          </div>
          <div className="admin-topbar-tools">
            {canSeeInbox && (
              <button
                type="button"
                className="admin-icon-button"
                onClick={() => navigate('/admin/inbox')}
                aria-label={pendingCount > 0 ? `Open enquiries, ${pendingCount} awaiting a reply` : 'Open enquiries'}
                title={pendingCount > 0 ? `${pendingCount} enquiries awaiting a reply` : 'Open enquiries'}
              >
                <Bell size={18} />
                {pendingCount > 0 && <span className="admin-dot" aria-hidden="true" />}
              </button>
            )}
            <div className="admin-account">
              <button type="button" className="admin-account-button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-haspopup="menu">
                <span className="admin-avatar" aria-hidden="true">
                  {(profile?.full_name || 'Staff').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className="admin-account-name">
                  <strong>{profile?.full_name || 'Staff member'}</strong>
                  <small>{ROLE_LABELS[role] || role}</small>
                </span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="admin-account-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); navigate('/admin/account'); }}>
                    <KeyRound size={16} aria-hidden="true" /> Change password
                  </button>
                  <Link role="menuitem" to="/" onClick={() => setMenuOpen(false)}>View public website</Link>
                  <button type="button" role="menuitem" className="danger" onClick={handleSignOut}>
                    <LogOut size={16} aria-hidden="true" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin-content" id="admin-content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="account" element={<AccountPanel />} />
            <Route path="programmes" element={guarded('programmes', <ContentPanel sectionKey="programmes" />)} />
            <Route path="news" element={guarded('news', <ContentPanel sectionKey="news" />)} />
            <Route path="events" element={guarded('events', <ContentPanel sectionKey="events" />)} />
            <Route path="partners" element={guarded('partners', <ContentPanel sectionKey="partners" />)} />
            <Route path="faqs" element={guarded('faqs', <ContentPanel sectionKey="faqs" />)} />
            <Route path="gallery" element={guarded('gallery', <ContentPanel sectionKey="gallery" />)} />
            <Route path="impact_reports" element={guarded('impact_reports', <ContentPanel sectionKey="impact_reports" />)} />
            <Route path="site_pages" element={guarded('site_pages', <ContentPanel sectionKey="site_pages" />)} />
            <Route path="donations" element={guarded('donations', <DonationLedger />)} />
            <Route path="allocations" element={guarded('allocations', <Allocations />)} />
            <Route path="reports" element={guarded('reports', <Reports />)} />
            <Route path="beneficiaries" element={guarded('beneficiaries', <CaseManager />)} />
            <Route path="staff_profiles" element={guarded('staff_profiles', <StaffManager />)} />
            <Route path="inbox" element={guarded('inbox', <Inbox />)} />
            <Route path="newsletter" element={guarded('newsletter', <NewsletterManager />)} />
            <Route path="audit_logs" element={guarded('audit_logs', <AuditTrail />)} />
            <Route path="settings" element={guarded('settings', <FoundationSettings />)} />
            <Route path="email_settings" element={guarded('email_settings', <EmailDelivery />)} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function AccountPanel() {
  const { session, refreshProfile } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) { toast.error('The two passwords do not match.'); return; }
    if (password.length < 12) { toast.error('Use at least 12 characters.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/api/account/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ new_password: password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'The password could not be updated.');
      setPassword(''); setConfirm('');
      toast.success('Your password has been updated.');
      await refreshProfile();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-panel admin-panel-narrow">
      <header className="admin-page-head">
        <div>
          <span className="admin-eyebrow">ACCOUNT SECURITY</span>
          <h1>Change your password</h1>
          <p>Choose a password of at least 12 characters. You stay signed in on this device.</p>
        </div>
      </header>
      <form className="admin-form" onSubmit={submit}>
        <label className="admin-field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Confirm new password</span>
          <input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>
        <button className="button" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const { loading, isSignedIn, canAccessAdmin, profile } = useAuth();

  if (!isConfigured) {
    return (
      <div className="admin-boot">
        <h2>Administration setup required</h2>
        <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend environment, then rebuild.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-boot" role="status">
        <span className="admin-boot-spinner" aria-hidden="true" />
        <p>Checking your access…</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="sign-in" element={isSignedIn && canAccessAdmin ? <Navigate to="/admin" replace /> : <SignIn />} />
        <Route
          path="*"
          element={
            !isSignedIn ? <Navigate to="/admin/sign-in" replace />
              : !canAccessAdmin ? (
                <div className="admin-boot">
                  <h2>Access unavailable</h2>
                  <p>Your staff account is inactive or has no assigned role. Ask a super administrator to review it.</p>
                </div>
              )
              : profile?.must_change_password ? <PasswordGate />
              : <Shell />
          }
        />
      </Routes>
    </ToastProvider>
  );
}
