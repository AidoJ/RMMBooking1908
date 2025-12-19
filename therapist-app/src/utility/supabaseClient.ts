import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create client - token will be set via setSession when user logs in
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Function to set the therapist session after login
export const setTherapistSession = (token: string) => {
  // Set a fake Supabase session using the custom JWT
  supabaseClient.auth.setSession({
    access_token: token,
    refresh_token: token, // Using same token as we don't have refresh
  });
};
