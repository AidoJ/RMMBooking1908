import { AuthBindings } from "@refinedev/core";
import { supabaseClient } from "./utility";

// Define login credentials type
interface LoginCredentials {
  email: string;
  password: string;
}

const authProvider: AuthBindings = {
  login: async ({ email, password }: LoginCredentials) => {
    try {
      console.log('Attempting login for:', email);
      
      // THIS IS THE KEY LINE - using "admin_users" table
      const { data, error } = await supabaseClient
        .from("admin_users")  // ← THIS MUST BE "admin_users" NOT "users"
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .eq("is_active", true)
        .single();

      console.log('Login response:', { data, error });

      if (error || !data) {
        return {
          success: false,
          error: {
            message: "Invalid email or password",
            name: "Login Error",
          },
        };
      }

      // Store user info
      localStorage.setItem("user", JSON.stringify(data));
      
      return {
        success: true,
        redirectTo: "/",
      };
    } catch (error: unknown) {
      console.error('Login error:', error);
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
    localStorage.removeItem("user");
    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    const user = localStorage.getItem("user");
    if (user) {
      return { authenticated: true };
    }
    return {
      authenticated: false,
      logout: true,
      redirectTo: "/login",
    };
  },

  getPermissions: async () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.role;
    }
    return null;
  },

  getIdentity: async () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return {
        id: userData.id,
        email: userData.email,
        name: `${userData.first_name} ${userData.last_name}`,
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
