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
    await realSupabaseClient.auth.signOut();
    localStorage.removeItem('admin_user');
    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    const { data: { session } } = await realSupabaseClient.auth.getSession();

    if (session) {
      return { authenticated: true };
    }

    return {
      authenticated: false,
      logout: true,
      redirectTo: "/login",
    };
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
