import React from 'react';
import { useGetIdentity } from '@refinedev/core';
import { ThemedSiderV2 } from '@refinedev/antd';
import { UserIdentity } from '../utils/roleUtils';

interface CustomSiderProps {
  [key: string]: any;
}

export const CustomSider: React.FC<CustomSiderProps> = (props) => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  
  // If user is a therapist, hide admin-only menu items
  const hideMenuItems = React.useMemo(() => {
    if (identity?.role === 'therapist') {
      return [
        'quotes',
        'discount_codes', 
        'gift_cards',
        'therapist_payments',
        'therapist_profiles',
        'customers',
        'services',
        'reports',
        'system-settings',
        'user-management',
        'activity-logs'
      ];
    }
    
    // For admin and super_admin, hide therapist-only items
    if (identity?.role === 'admin' || identity?.role === 'super_admin') {
      return ['my-profile', 'my-earnings'];
    }
    
    return [];
  }, [identity?.role]);

  return (
    <ThemedSiderV2 
      {...props}
      render={({ items, logout, collapsed }) => {
        // Filter out hidden items
        const filteredItems = items?.filter(item => {
          if (item?.key && hideMenuItems.includes(item.key)) {
            return false;
          }
          return true;
        });

        return (
          <>
            {filteredItems}
            {logout}
          </>
        );
      }}
    />
  );
};