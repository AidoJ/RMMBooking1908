import { AuthBindings } from "@refinedev/core";
import { AdminDataService } from "./services/adminDataService";

// Define login credentials type
interface LoginCredentials {
  email: string;
  password: string;
}

const authProvider: AuthBindings = {
  login: async ({ email, password }: LoginCredentials) => {
    try {
      console.log('🔐 Attempting secure admin login for:', email);
      
      // Use AdminDataService for secure authentication
      const result = await AdminDataService.authenticate(email, password);

      if (!result.success) {
        console.error('❌ Login failed:', result.error);
        return {
          success: false,
          error: {
            message: result.error || "Invalid email or password",
            name: "Login Error",
          },
        };
      }

      console.log('✅ Login successful:', result.user?.email, 'Role:', result.user?.role);
      
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
    AdminDataService.logout();
    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    const isAuthenticated = AdminDataService.isAuthenticated();
    if (isAuthenticated) {
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
