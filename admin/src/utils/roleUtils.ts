// src/utils/roleUtils.ts
export interface UserIdentity {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: 'super_admin' | 'admin' | 'therapist' | 'customer';
  name?: string;
}

export type UserRole = 'super_admin' | 'admin' | 'therapist' | 'customer';

export interface RolePermissions {
  // Dashboard access
  canViewDashboard: boolean;
  canViewAllBookings: boolean;
  canViewOwnBookings: boolean;
  
  // Booking management
  canCreateBookings: boolean;
  canEditAllBookings: boolean;
  canEditOwnBookings: boolean;
  canDeleteBookings: boolean;
  canViewBookingCalendar: boolean;
  canAssignTherapists: boolean;
  
  // Therapist management
  canViewAllTherapists: boolean;
  canCreateTherapists: boolean;
  canEditAllTherapists: boolean;
  canEditOwnProfile: boolean;
  canManageAvailability: boolean;
  canViewOwnEarnings: boolean;
  canViewAllEarnings: boolean;
  
  // Customer management
  canViewAllCustomers: boolean;
  canEditCustomers: boolean;
  canCreateCustomers: boolean;
  canDeleteCustomers: boolean;
  
  // Service management
  canViewServices: boolean;
  canEditServices: boolean;
  canCreateServices: boolean;
  canDeleteServices: boolean;
  
  // System settings
  canAccessSystemSettings: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canViewFinancials: boolean;
  
  // Activity monitoring
  canViewActivityLogs: boolean;
  canViewAllSessions: boolean;
}

export const getRolePermissions = (role: UserRole | undefined): RolePermissions => {
  const basePermissions: RolePermissions = {
    canViewDashboard: false,
    canViewAllBookings: false,
    canViewOwnBookings: false,
    canCreateBookings: false,
    canEditAllBookings: false,
    canEditOwnBookings: false,
    canDeleteBookings: false,
    canViewBookingCalendar: false,
    canAssignTherapists: false,
    canViewAllTherapists: false,
    canCreateTherapists: false,
    canEditAllTherapists: false,
    canEditOwnProfile: false,
    canManageAvailability: false,
    canViewOwnEarnings: false,
    canViewAllEarnings: false,
    canViewAllCustomers: false,
    canEditCustomers: false,
    canCreateCustomers: false,
    canDeleteCustomers: false,
    canViewServices: false,
    canEditServices: false,
    canCreateServices: false,
    canDeleteServices: false,
    canAccessSystemSettings: false,
    canManageUsers: false,
    canViewReports: false,
    canViewFinancials: false,
    canViewActivityLogs: false,
    canViewAllSessions: false,
  };

  switch (role) {
    case 'super_admin':
      // Super Admin: Everything enabled
      return {
        ...basePermissions,
        canViewDashboard: true,
        canViewAllBookings: true,
        canViewOwnBookings: true,
        canCreateBookings: true,
        canEditAllBookings: true,
        canEditOwnBookings: true,
        canDeleteBookings: true,
        canViewBookingCalendar: true,
        canAssignTherapists: true,
        canViewAllTherapists: true,
        canCreateTherapists: true,
        canEditAllTherapists: true,
        canEditOwnProfile: true,
        canManageAvailability: true,
        canViewOwnEarnings: true,
        canViewAllEarnings: true,
        canViewAllCustomers: true,
        canEditCustomers: true,
        canCreateCustomers: true,
        canDeleteCustomers: true,
        canViewServices: true,
        canEditServices: true,
        canCreateServices: true,
        canDeleteServices: true,
        canAccessSystemSettings: true,
        canManageUsers: true,
        canViewReports: true,
        canViewFinancials: true,
        canViewActivityLogs: true,
        canViewAllSessions: true,
      };

    case 'admin':
      // Admin: Business operations, no system settings
      return {
        ...basePermissions,
        canViewDashboard: true,
        canViewAllBookings: true,
        canViewOwnBookings: true,
        canCreateBookings: true,
        canEditAllBookings: true,
        canEditOwnBookings: true,
        canDeleteBookings: true,
        canViewBookingCalendar: true,
        canAssignTherapists: true,
        canViewAllTherapists: true,
        canCreateTherapists: false,
        canEditAllTherapists: true,
        canEditOwnProfile: true,
        canManageAvailability: true,
        canViewOwnEarnings: true,
        canViewAllEarnings: true,
        canViewAllCustomers: true,
        canEditCustomers: true,
        canCreateCustomers: true,
        canDeleteCustomers: false,
        canViewServices: true,
        canEditServices: true,
        canCreateServices: true,
        canDeleteServices: false,
        canAccessSystemSettings: false,
        canManageUsers: false,
        canViewReports: true,
        canViewFinancials: true,
        canViewActivityLogs: false,
        canViewAllSessions: false,
      };

    case 'therapist':
      // Therapist: Own profile and bookings only
      return {
        ...basePermissions,
        canViewDashboard: true,
        canViewAllBookings: false,
        canViewOwnBookings: true,
        canCreateBookings: false,
        canEditAllBookings: false,
        canEditOwnBookings: true,
        canDeleteBookings: false,
        canViewBookingCalendar: true,
        canAssignTherapists: false,
        canViewAllTherapists: false,
        canCreateTherapists: false,
        canEditAllTherapists: false,
        canEditOwnProfile: true,
        canManageAvailability: true,
        canViewOwnEarnings: true,
        canViewAllEarnings: false,
        canViewAllCustomers: false,
        canEditCustomers: false,
        canCreateCustomers: false,
        canDeleteCustomers: false,
        canViewServices: true,
        canEditServices: false,
        canCreateServices: false,
        canDeleteServices: false,
        canAccessSystemSettings: false,
        canManageUsers: false,
        canViewReports: false,
        canViewFinancials: false,
        canViewActivityLogs: false,
        canViewAllSessions: false,
      };

    case 'customer':
      // Customer: Very limited access
      return {
        ...basePermissions,
        canViewDashboard: false,
        canViewOwnBookings: true,
        canEditOwnBookings: false,
        canEditOwnProfile: true,
        canViewServices: true,
      };

    default:
      return basePermissions;
  }
};

// Utility functions for common role checks
export const isSuperAdmin = (role: UserRole | undefined): boolean => role === 'super_admin';
export const isAdmin = (role: UserRole | undefined): boolean => role === 'admin' || role === 'super_admin';
export const isTherapist = (role: UserRole | undefined): boolean => role === 'therapist';
export const isCustomer = (role: UserRole | undefined): boolean => role === 'customer';

// Check if user can access a specific feature
export const canAccess = (
  userRole: UserRole | undefined, 
  permission: keyof RolePermissions
): boolean => {
  const privileges = getRolePermissions(userRole);
  return privileges[permission];
};

// Get user-friendly role name
export const getRoleName = (role: UserRole | undefined): string => {
  switch (role) {
    case 'super_admin': return 'Super Administrator';
    case 'admin': return 'Administrator';
    case 'therapist': return 'Therapist';
    case 'customer': return 'Customer';
    default: return 'Unknown';
  }
};

// Get role badge color
export const getRoleColor = (role: UserRole | undefined): string => {
  switch (role) {
    case 'super_admin': return 'red';
    case 'admin': return 'blue';
    case 'therapist': return 'green';
    case 'customer': return 'orange';
    default: return 'default';
  }
};
