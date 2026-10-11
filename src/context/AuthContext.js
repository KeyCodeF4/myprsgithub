import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { reportError } from '../utils/errorReporter';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [accountProfile, setAccountProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const ensureProfile = useCallback(async (authUser) => {
    if (!authUser?.id) return null;
    const prefix = String(authUser.email || 'lifter').split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18) || 'lifter';
    const suffix = authUser.id.replace(/-/g, '').slice(0, 6);
    const { error } = await supabase.from('users').upsert({
      id: authUser.id,
      username: `${prefix}-${suffix}`,
      referral_code: `MPRS-${suffix.toUpperCase()}`,
    }, { onConflict: 'id' });
    if (error) reportError(error, 'ensure-account-profile');
    return error || null;
  }, []);

  const refreshAccountProfile = useCallback(async (userId) => {
    if (!userId) {
      setAccountProfile(null);
      return null;
    }

    try {
      // The database owns founder allocation. Calling this repeatedly is safe:
      // an existing founder always receives the same serial number.
      const { error: claimError } = await supabase.rpc('claim_founder_status');
      if (claimError && claimError.code !== 'PGRST202') {
        reportError(claimError, 'claim-founder-status');
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, referral_code, founder_number')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      setAccountProfile(data || null);
      return data || null;
    } catch (error) {
      reportError(error, 'load-account-profile');
      return null;
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) reportError(error, 'load-auth-session');
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) await refreshAccountProfile(session.user.id);
      })
      .catch(error => reportError(error, 'load-auth-session'))
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) refreshAccountProfile(session.user.id);
      else setAccountProfile(null);
    });

    return () => subscription?.unsubscribe();
  }, [refreshAccountProfile]);

  const signUp = useCallback(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
    if (error) return { data, error };
    if (data?.session?.user) {
      await ensureProfile(data.session.user);
      await refreshAccountProfile(data.session.user.id);
    }
    return { data, error, requiresEmailConfirmation: !!data?.user && !data?.session };
  }, [ensureProfile, refreshAccountProfile]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (!error && data?.user) await ensureProfile(data.user);
    return { data, error };
  }, [ensureProfile]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
      setAccountProfile(null);
    }
    return { error };
  }, []);

  return (
    <AuthContext.Provider value={{
      user, session, accountProfile, loading,
      signUp, signIn, signOut, refreshAccountProfile,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
