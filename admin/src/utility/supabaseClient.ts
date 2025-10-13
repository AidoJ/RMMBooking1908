/**
 * Secure Supabase Client
 * 
 * This now exports adminDataService which routes all queries through secure proxy.
 * The actual Supabase client is only used for liveProvider (real-time subscriptions).
 */

import { createClient } from "@refinedev/supabase";
import adminDataService from "../services/adminDataService";

// Use environment variables with VITE_ prefix (Netlify sets these during build)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://dcukfurezlkagvvwgsgr.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdWtmdXJlemxrYWd2dndnc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjM0NjQsImV4cCI6MjA2NzQ5OTQ2NH0.ThXQKNHj0XpSkPa--ghmuRXFJ7nfcf0YVlH0liHofFw";

// Real Supabase client (only used for liveProvider/real-time subscriptions)
export const realSupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: {
    schema: "public",
  },
  auth: {
    persistSession: false, // Admin doesn't use Supabase Auth
  },
});

// Secure client that routes through proxy (used for all data operations)
// This is exported as supabaseClient for backwards compatibility with existing code
export const supabaseClient = adminDataService;
