import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, apiUrl } from './supabase';

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
  // Without a deadline an unreachable API leaves the admin area stuck on
  // "Checking your access…" until the browser's own multi-minute timeout.
  const response = await fetch(`${apiUrl}/api/me`, {
    headers: { Authorization: `Bearer ${activeSession.access_token}` },
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(8000)
      : undefined,
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
    // so a deployment running an older backend still lets staff in. This read
    // also gets a deadline: an unreachable Supabase must not leave the admin
    // area spinning on "Checking your access…" forever.
    if (result.status === 'error') {
      try {
        let query = supabase
          .from('staff_profiles')
          .select('user_id,full_name,role,is_active,must_change_password')
          .eq('user_id', activeSession.user.id)
          .maybeSingle();
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
          query = query.abortSignal(AbortSignal.timeout(8000));
        }
        const { data, error } = await query;
        if (!error) result = { status: data ? (data.is_active ? 'ok' : 'inactive') : 'no-profile', profile: data };
      } catch {
        result = { status: 'error' };
      }
    }
    setProfile(result.profile || null);
    setAccessState(result.status);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return undefined; }
    let active = true;

    // `loading` gates the whole admin area. Every path out of this effect must
    // clear it, otherwise a rejected or stalled session lookup strands the user
    // on the boot screen with no way forward. `getSession()` can stall when the
    // auth client waits on a browser lock, so a watchdog clears the gate too.
    const watchdog = setTimeout(() => {
      if (active) setLoading(false);
    }, 8000);

    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setProfile(null);
        setAccessState('error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      try {
        await loadProfile(nextSession);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
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
