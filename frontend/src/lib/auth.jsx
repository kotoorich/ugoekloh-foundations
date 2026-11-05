import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase, isConfigured } from './supabase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

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
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (activeSession) => {
    if (!activeSession || !supabase) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('user_id,full_name,role,is_active,must_change_password')
      .eq('user_id', activeSession.user.id)
      .maybeSingle();
    setProfile(error ? null : data);
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
    signOut,
    refreshProfile,
    isSignedIn: Boolean(session),
    isActiveStaff: Boolean(profile?.is_active),
    role: profile?.role || null,
    accessToken: session?.access_token || null,
    canAccessAdmin: Boolean(profile?.is_active && profile?.role),
  }), [session, profile, loading, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Guard for the admin area.
 *
 * Replaces the old window.confirm-on-popstate trick, which did not actually
 * stop the browser Back button from re-entering the dashboard.
 */
export function RequireStaff({ children }) {
  const { loading, isSignedIn, canAccessAdmin } = useAuth();
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
  if (!isSignedIn) {
    return <Navigate to="/admin/sign-in" replace state={{ from: location.pathname }} />;
  }
  if (!canAccessAdmin) {
    return (
      <div className="admin-boot">
        <h2>Access unavailable</h2>
        <p>Your staff account is inactive or has no assigned role. Ask a super administrator to review it.</p>
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
