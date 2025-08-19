import React from 'react';
import { useGetIdentity } from '@refinedev/core';
import { Typography, Spin } from 'antd';
import { UserIdentity, canAccess, RolePermissions } from '../utils/roleUtils';

const { Title, Text } = Typography;

interface RoleGuardProps {
  children: React.ReactNode;
  requiredPermission?: keyof RolePermissions;
  requiredRole?: 'super_admin' | 'admin' | 'therapist' | 'customer';
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ 
  children, 
  requiredPermission, 
  requiredRole,
  fallback 
}) => {
  const { data: identity, isLoading } = useGetIdentity<UserIdentity>();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Check role-based access
  if (requiredRole && identity?.role !== requiredRole) {
    return fallback || (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={3}>Access Denied</Title>
        <Text>You don't have permission to access this page.</Text>
      </div>
    );
  }

  // Check permission-based access
  if (requiredPermission && !canAccess(identity?.role, requiredPermission)) {
    return fallback || (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={3}>Access Denied</Title>
        <Text>You don't have permission to access this page.</Text>
      </div>
    );
  }

  return <>{children}</>;
};
