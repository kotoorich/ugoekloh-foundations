import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase, isConfigured, apiUrl } from './supabase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/**
 * Ask the backend who this account is.
 *
 * The dashboard previously read staff_profiles straight from the browser. That
 * read is governed by row-level security, so any problem with the policy or the
 * profile row looked identical to "you are not staff" and locked people out
 * with no way to tell why. The backend answers the same question through the
 * service role, and distinguishes three cases the interface needs to treat
 * differently: not a staff account at all, a staff account that is switched
 * off, and a staff account that is fine.
 */
async function fetchStaffProfile(activeSession) {
  const response = await fetch(`${apiUrl}/api/me`, {
    headers: { Authorization: `Bearer ${activeSession.access_token}` },
  });
  if (response.status === 401) return { status: 'unauthorized' };
  if (!response.ok) return { status: 'error' };
  const payload = await response.json();
  if (!payload.found) return { status: 'no-profile', profile: null };
  return { status: payload.is_active ? 'ok' : 'inactive', profile: payload };
}

/**
 * Single source of truth for the signed-in staff member.
 *
 * The previous admin shell rendered immediately and only checked the session
 * afterwards, so the dashboard was briefly visible to anyone who opened
 * /admin. Here the shell is not rendered until `loading` is false.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accessState, setAccessState] = useState('unknown');
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (activeSession) => {
    if (!activeSession || !supabase) {
      setProfile(null);
      setAccessState('signed-out');
      return;
    }
    let result;
    try {
      result = await fetchStaffProfile(activeSession);
    } catch {
      result = { status: 'error' };
    }
    // Fall back to reading the profile directly if the API could not answer,
    // so a deployment running an older backend still lets staff in.
    if (result.status === 'error') {
      const { data, error } = await supabase
        .from('staff_profiles')
        .select('user_id,full_name,role,is_active,must_change_password')
        .eq('user_id', activeSession.user.id)
        .maybeSingle();
      if (!error) result = { status: data ? (data.is_active ? 'ok' : 'inactive') : 'no-profile', profile: data };
    }
    setProfile(result.profile || null);
    setAccessState(result.status);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return undefined; }
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      await loadProfile(nextSession);
      setLoading(false);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  const value = useMemo(() => ({
    session,
    profile,
    loading,
    accessState,
    signOut,
    refreshProfile,
    isSignedIn: Boolean(session),
    isActiveStaff: Boolean(profile?.is_active),
    role: profile?.role || null,
    email: profile?.email || session?.user?.email || null,
    accessToken: session?.access_token || null,
    canAccessAdmin: Boolean(profile?.is_active && profile?.role),
  }), [session, profile, loading, accessState, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Guard for the admin area.
 *
 * Replaces the old window.confirm-on-popstate trick, which did not actually
 * stop the browser Back button from re-entering the dashboard.
 */
export function RequireStaff({ children }) {
  const { loading, isSignedIn, canAccessAdmin, accessState, signOut, email } = useAuth();
  const location = useLocation();

  if (!isConfigured) return children;
  if (loading) {
    return (
      <div className="admin-boot" role="status">
        <span className="admin-boot-spinner" aria-hidden="true" />
        <p>Checking your access…</p>
      </div>
    );
  }
  if (!isSignedIn || accessState === 'unauthorized') {
    return <Navigate to="/admin/sign-in" replace state={{ from: location.pathname }} />;
  }
  if (!canAccessAdmin) {
    // Say which of the three problems this actually is. The old message covered
    // both cases at once, which made a fixable database problem look like a
    // deactivated account.
    const messages = {
      inactive: {
        heading: 'This staff account is switched off',
        body: 'Your account exists but is not active. An administrator can reactivate it from Staff accounts.',
      },
      'no-profile': {
        heading: 'No staff profile is linked to this sign-in',
        body: 'You signed in successfully, but no staff record is linked to this account. An administrator needs to create one for you in Staff accounts.',
      },
      error: {
        heading: 'Your access could not be checked',
        body: 'The foundation API did not answer. If this is a new deployment, wait a moment and reload; otherwise check that the API address is correct.',
      },
    };
    const message = messages[accessState] || messages.error;
    return (
      <div className="admin-boot">
        <h2>{message.heading}</h2>
        <p>{message.body}</p>
        {email && <p className="admin-boot-account">Signed in as <strong>{email}</strong></p>}
        <div className="admin-boot-actions">
          <button type="button" className="button button-outline" onClick={() => window.location.reload()}>Try again</button>
          <button type="button" className="button button-outline" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }
  return children;
}

/** Redirect a signed-in staff member away from the sign-in page. */
export function RedirectIfSignedIn({ children }) {
  const { loading, isSignedIn, canAccessAdmin } = useAuth();
  if (loading) {
    return (
      <div className="admin-boot" role="status">
        <span className="admin-boot-spinner" aria-hidden="true" />
        <p>Checking your access…</p>
      </div>
    );
  }
  if (isSignedIn && canAccessAdmin) return <Navigate to="/admin" replace />;
  return children;
}
