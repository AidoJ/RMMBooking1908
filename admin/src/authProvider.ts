import { AuthBindings } from "@refinedev/core";
import { realSupabaseClient } from "./utility/supabaseClient";

// Define login credentials type
interface LoginCredentials {
  email: string;
  password: string;
}

const authProvider: AuthBindings = {
  login: async ({ email, password }: LoginCredentials) => {
    try {
      console.log('🔐 Attempting Supabase Auth login for:', email);

      // Use Supabase Auth for authentication
      const { data, error } = await realSupabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login failed:', error.message);
        return {
          success: false,
          error: {
            message: error.message || "Invalid email or password",
            name: "Login Error",
          },
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: {
            message: "Login failed - no user returned",
            name: "Login Error",
          },
        };
      }

      // Fetch admin_users record to get role and other info
      const { data: adminUser, error: adminError } = await realSupabaseClient
        .from('admin_users')
        .select('*')
        .eq('auth_id', data.user.id)
        .single();

      if (adminError || !adminUser) {
        console.error('❌ Failed to fetch admin user:', adminError);
        await realSupabaseClient.auth.signOut();
        return {
          success: false,
          error: {
            message: "Access denied - not an admin user",
            name: "Authorization Error",
          },
        };
      }

      console.log('✅ Login successful:', data.user.email, 'Role:', adminUser.role);

      // Store user info in localStorage for getPermissions and getIdentity
      localStorage.setItem('admin_user', JSON.stringify(adminUser));

      return {
        success: true,
        redirectTo: "/",
      };
    } catch (error: unknown) {
      console.error('❌ Login error:', error);
      return {
        success: false,
        error: {
          message: "Login failed: " + (error instanceof Error ? error.message : 'Unknown error'),
          name: "Network Error",
        },
      };
    }
  },

  logout: async () => {
    try {
      console.log('🚪 Logging out...');
      
      // Clear localStorage first to prevent re-authentication
      localStorage.removeItem('admin_user');
      
      // Sign out from Supabase Auth
      const { error: signOutError } = await realSupabaseClient.auth.signOut();
      
      if (signOutError) {
        console.error('❌ Error during sign out:', signOutError);
        // Continue with logout even if signOut fails
      }
      
      // Clear any remaining session data
      // Force clear Supabase session storage
      const supabaseSessionKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('sb-') || key.includes('supabase')
      );
      supabaseSessionKeys.forEach(key => localStorage.removeItem(key));
      
      console.log('✅ Logout complete');
      
      return {
        success: true,
        redirectTo: "/login",
      };
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if there's an error, clear localStorage and redirect
      localStorage.removeItem('admin_user');
      const supabaseSessionKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('sb-') || key.includes('supabase')
      );
      supabaseSessionKeys.forEach(key => localStorage.removeItem(key));
      
      return {
        success: true,
        redirectTo: "/login",
      };
    }
  },

  check: async () => {
    try {
      // First check if admin_user exists - if not, user is definitely not authenticated
      const adminUser = localStorage.getItem('admin_user');
      if (!adminUser) {
        // Clear any Supabase session data
        await realSupabaseClient.auth.signOut();
        return {
          authenticated: false,
          logout: true,
          redirectTo: "/login",
        };
      }

      const { data: { session }, error: sessionError } = await realSupabaseClient.auth.getSession();

      if (sessionError) {
        console.error('❌ Error checking session:', sessionError);
        // Clear admin_user if session check fails
        localStorage.removeItem('admin_user');
        return {
          authenticated: false,
          logout: true,
          redirectTo: "/login",
        };
      }

      if (!session || !session.access_token) {
        // Clear any stale admin_user data
        localStorage.removeItem('admin_user');
        return {
          authenticated: false,
          logout: true,
          redirectTo: "/login",
        };
      }

      // Verify admin_user exists in localStorage (should have been set during login)
      const adminUser = localStorage.getItem('admin_user');
      if (!adminUser) {
        console.warn('⚠️ Session exists but admin_user not found, fetching...');
        // Try to fetch admin user from database
        try {
          const { data: adminUserData, error: adminError } = await realSupabaseClient
            .from('admin_users')
            .select('*')
            .eq('auth_id', session.user.id)
            .single();

          if (adminError || !adminUserData) {
            console.error('❌ Admin user not found for session');
            await realSupabaseClient.auth.signOut();
            return {
              authenticated: false,
              logout: true,
              redirectTo: "/login",
            };
          }

          // Store admin user
          localStorage.setItem('admin_user', JSON.stringify(adminUserData));
          return { authenticated: true };
        } catch (error) {
          console.error('❌ Error fetching admin user:', error);
          await realSupabaseClient.auth.signOut();
          return {
            authenticated: false,
            logout: true,
            redirectTo: "/login",
          };
        }
      }

      return { authenticated: true };
    } catch (error) {
      console.error('❌ Error in auth check:', error);
      return {
        authenticated: false,
        logout: true,
        redirectTo: "/login",
      };
    }
  },

  getPermissions: async () => {
    const adminUser = localStorage.getItem("admin_user");
    if (adminUser) {
      const userData = JSON.parse(adminUser);
      return userData.role;
    }
    return null;
  },

  getIdentity: async () => {
    const adminUser = localStorage.getItem("admin_user");
    if (adminUser) {
      const userData = JSON.parse(adminUser);
      return {
        id: userData.id,
        email: userData.email,
        name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
      };
    }
    return null;
  },

  onError: async (error: any) => {
    console.error('Auth error:', error);
    return { error };
  },
};

export default authProvider;
