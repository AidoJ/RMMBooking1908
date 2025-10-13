/**
 * Secure Supabase Client Replacement
 * 
 * Drop-in replacement for supabaseClient that routes all queries through secure proxy.
 * This allows existing code to work without changes while adding security.
 */

import adminDataService from "../services/adminDataService";

// Export adminDataService as supabaseClient for backwards compatibility
export const supabaseClient = adminDataService;

// Re-export for compatibility
export default adminDataService;

