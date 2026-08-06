import { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { onAuthStateChange, signIn, signUp, signOut as sbSignOut } from '../services/supabaseService';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data, error } = await signIn(email, password);
    if (error) throw error;
    return data;
  }, []);

  const register = useCallback(async (email, password, metadata) => {
    const { data, error } = await signUp(email, password, metadata);
    if (error) throw error;
    return data;
  }, []);

  const logout = useCallback(async () => {
    await sbSignOut();
    setUser(null);
    setSession(null);
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    isSupabaseAuth: isSupabaseConfigured(),
    login,
    register,
    logout,
  };
}

export default useAuth;
