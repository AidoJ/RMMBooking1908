import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create client with auth persistence enabled
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Enable session persistence for Supabase Auth
    storage: window.localStorage, // Use localStorage for session
    autoRefreshToken: true, // Auto refresh tokens
    detectSessionInUrl: true, // Detect session from URL (for password reset)
  },
});
