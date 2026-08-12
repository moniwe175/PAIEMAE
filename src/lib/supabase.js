import { createClient } from '@supabase/supabase-js';

// Supabase project URL and anon key
// A anon key é pública por design (proteção real = RLS no banco);
// o segredo de verdade (service_role) nunca entra no frontend.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ecwizjyflxcickbfzhcp.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjd2l6anlmbHhjaWNrYmZ6aGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDAwODUsImV4cCI6MjA5Mjk3NjA4NX0.o6v0_Z0XhIjFhlD8P4MBZN2F9t_ljXq0sJ8ZsvDWQBA';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => !!supabase;

// Helper to get current user
export async function getCurrentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Helper to get current session
export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export default supabase;
