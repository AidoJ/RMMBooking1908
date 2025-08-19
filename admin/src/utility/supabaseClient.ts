import { createClient } from "@refinedev/supabase";

// Use environment variables instead of hardcoded values
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://dcukfurezlkagvvwgsgr.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdWtmdXJlemxrYWd2dndnc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjM0NjQsImV4cCI6MjA2NzQ5OTQ2NH0.ThXQKNHj0XpSkPa--ghmuRXFJ7nfcf0YVlH0liHofFw";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: {
    schema: "public",
  },
  auth: {
    persistSession: true,
  },
});
