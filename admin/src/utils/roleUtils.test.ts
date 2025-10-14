import {
  getRolePermissions,
  isSuperAdmin,
  isAdmin,
  isTherapist,
  isCustomer,
  canAccess,
  getRoleName,
  getRoleColor,
  type UserRole,
  type RolePermissions,
} from './roleUtils';

describe('roleUtils', () => {
  describe('getRolePermissions', () => {
    it('should return all permissions false for undefined role', () => {
      const permissions = getRolePermissions(undefined);
      
      expect(permissions.canViewDashboard).toBe(false);
      expect(permissions.canViewAllBookings).toBe(false);
      expect(permissions.canAccessSystemSettings).toBe(false);
    });

    it('should return correct permissions for super_admin', () => {
      const permissions = getRolePermissions('super_admin');
      
      expect(permissions.canViewDashboard).toBe(true);
      expect(permissions.canViewAllBookings).toBe(true);
      expect(permissions.canCreateBookings).toBe(true);
      expect(permissions.canEditAllBookings).toBe(true);
      expect(permissions.canDeleteBookings).toBe(true);
      expect(permissions.canAccessSystemSettings).toBe(true);
      expect(permissions.canManageUsers).toBe(true);
      expect(permissions.canViewActivityLogs).toBe(true);
    });

    it('should return correct permissions for admin', () => {
      const permissions = getRolePermissions('admin');
      
      expect(permissions.canViewDashboard).toBe(true);
      expect(permissions.canViewAllBookings).toBe(true);
      expect(permissions.canCreateBookings).toBe(true);
      expect(permissions.canEditAllBookings).toBe(true);
      expect(permissions.canDeleteBookings).toBe(true);
      expect(permissions.canCreateTherapists).toBe(false);
      expect(permissions.canAccessSystemSettings).toBe(false);
      expect(permissions.canManageUsers).toBe(false);
      expect(permissions.canViewActivityLogs).toBe(false);
    });

    it('should return correct permissions for therapist', () => {
      const permissions = getRolePermissions('therapist');
      
      expect(permissions.canViewDashboard).toBe(true);
      expect(permissions.canViewAllBookings).toBe(false);
      expect(permissions.canViewOwnBookings).toBe(true);
      expect(permissions.canEditOwnProfile).toBe(true);
      expect(permissions.canManageAvailability).toBe(true);
      expect(permissions.canAccessSystemSettings).toBe(false);
      expect(permissions.canCreateBookings).toBe(false);
    });

    it('should return correct permissions for customer', () => {
      const permissions = getRolePermissions('customer');
      
      expect(permissions.canViewDashboard).toBe(false);
      expect(permissions.canViewOwnBookings).toBe(true);
      expect(permissions.canEditOwnProfile).toBe(true);
      expect(permissions.canViewServices).toBe(true);
      expect(permissions.canEditOwnBookings).toBe(false);
      expect(permissions.canCreateBookings).toBe(false);
      expect(permissions.canAccessSystemSettings).toBe(false);
    });
  });

  describe('role check functions', () => {
    describe('isSuperAdmin', () => {
      it('should return true for super_admin', () => {
        expect(isSuperAdmin('super_admin')).toBe(true);
      });

      it('should return false for other roles', () => {
        expect(isSuperAdmin('admin')).toBe(false);
        expect(isSuperAdmin('therapist')).toBe(false);
        expect(isSuperAdmin('customer')).toBe(false);
        expect(isSuperAdmin(undefined)).toBe(false);
      });
    });

    describe('isAdmin', () => {
      it('should return true for admin and super_admin', () => {
        expect(isAdmin('admin')).toBe(true);
        expect(isAdmin('super_admin')).toBe(true);
      });

      it('should return false for other roles', () => {
        expect(isAdmin('therapist')).toBe(false);
        expect(isAdmin('customer')).toBe(false);
        expect(isAdmin(undefined)).toBe(false);
      });
    });

    describe('isTherapist', () => {
      it('should return true for therapist', () => {
        expect(isTherapist('therapist')).toBe(true);
      });

      it('should return false for other roles', () => {
        expect(isTherapist('admin')).toBe(false);
        expect(isTherapist('super_admin')).toBe(false);
        expect(isTherapist('customer')).toBe(false);
        expect(isTherapist(undefined)).toBe(false);
      });
    });

    describe('isCustomer', () => {
      it('should return true for customer', () => {
        expect(isCustomer('customer')).toBe(true);
      });

      it('should return false for other roles', () => {
        expect(isCustomer('admin')).toBe(false);
        expect(isCustomer('super_admin')).toBe(false);
        expect(isCustomer('therapist')).toBe(false);
        expect(isCustomer(undefined)).toBe(false);
      });
    });
  });

  describe('canAccess', () => {
    it('should return true when user has permission', () => {
      expect(canAccess('super_admin', 'canViewDashboard')).toBe(true);
      expect(canAccess('admin', 'canViewAllBookings')).toBe(true);
      expect(canAccess('therapist', 'canEditOwnProfile')).toBe(true);
      expect(canAccess('customer', 'canViewServices')).toBe(true);
    });

    it('should return false when user lacks permission', () => {
      expect(canAccess('therapist', 'canViewAllBookings')).toBe(false);
      expect(canAccess('customer', 'canViewDashboard')).toBe(false);
      expect(canAccess('admin', 'canAccessSystemSettings')).toBe(false);
      expect(canAccess(undefined, 'canViewDashboard')).toBe(false);
    });
  });

  describe('getRoleName', () => {
    it('should return correct role names', () => {
      expect(getRoleName('super_admin')).toBe('Super Administrator');
      expect(getRoleName('admin')).toBe('Administrator');
      expect(getRoleName('therapist')).toBe('Therapist');
      expect(getRoleName('customer')).toBe('Customer');
      expect(getRoleName(undefined)).toBe('Unknown');
    });
  });

  describe('getRoleColor', () => {
    it('should return correct colors for each role', () => {
      expect(getRoleColor('super_admin')).toBe('red');
      expect(getRoleColor('admin')).toBe('blue');
      expect(getRoleColor('therapist')).toBe('green');
      expect(getRoleColor('customer')).toBe('orange');
      expect(getRoleColor(undefined)).toBe('default');
    });
  });

  describe('edge cases', () => {
    it('should handle invalid role types gracefully', () => {
      const invalidRole = 'invalid_role' as UserRole;
      const permissions = getRolePermissions(invalidRole);
      
      expect(permissions.canViewDashboard).toBe(false);
      expect(permissions.canAccessSystemSettings).toBe(false);
    });

    it('should verify all permissions are defined in base permissions', () => {
      const permissions = getRolePermissions('super_admin');
      const basePermissions = getRolePermissions(undefined);
      
      const permissionKeys = Object.keys(basePermissions) as (keyof RolePermissions)[];
      
      permissionKeys.forEach(key => {
        expect(permissions).toHaveProperty(key);
        expect(typeof permissions[key]).toBe('boolean');
      });
    });
  });

  describe('permission hierarchy validation', () => {
    it('should ensure super_admin has all permissions that admin has', () => {
      const superAdminPerms = getRolePermissions('super_admin');
      const adminPerms = getRolePermissions('admin');
      
      Object.entries(adminPerms).forEach(([key, value]) => {
        if (value === true) {
          expect(superAdminPerms[key as keyof RolePermissions]).toBe(true);
        }
      });
    });

    it('should ensure customer has minimal permissions', () => {
      const customerPerms = getRolePermissions('customer');
      const truePermissions = Object.entries(customerPerms)
        .filter(([_, value]) => value === true)
        .map(([key]) => key);
      
      expect(truePermissions).toEqual([
        'canViewOwnBookings',
        'canEditOwnProfile',
        'canViewServices'
      ]);
    });

    it('should ensure therapist cannot access admin features', () => {
      const therapistPerms = getRolePermissions('therapist');
      
      expect(therapistPerms.canViewAllBookings).toBe(false);
      expect(therapistPerms.canCreateTherapists).toBe(false);
      expect(therapistPerms.canAccessSystemSettings).toBe(false);
      expect(therapistPerms.canManageUsers).toBe(false);
      expect(therapistPerms.canViewActivityLogs).toBe(false);
    });
  });
});