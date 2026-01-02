import React, { useState } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  message,
  Modal,
  Alert,
  Spin,
  Tooltip
} from 'antd';
import {
  SyncOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ToolOutlined
} from '@ant-design/icons';
import { RoleGuard } from '../../components/RoleGuard';
import { supabaseClient } from '../../utility';

const { Title, Text } = Typography;

interface SyncIssue {
  id: string;
  type: 'missing_profile' | 'missing_user' | 'role_mismatch';
  severity: 'error' | 'warning';
  description: string;
  therapistId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  currentRole?: string;
  expectedRole?: string;
  canAutoFix: boolean;
}

const SystemTools: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  const runSyncCheck = async () => {
    try {
      setLoading(true);
      setHasScanned(false);
      const foundIssues: SyncIssue[] = [];

      // 1. Check for therapist users without therapist profiles
      const { data: therapistUsers, error: usersError } = await supabaseClient
        .from('admin_users')
        .select('id, email, first_name, last_name, role')
        .eq('role', 'therapist');

      if (usersError) throw usersError;

      for (const user of therapistUsers || []) {
        const { data: profile } = await supabaseClient
          .from('therapist_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) {
          foundIssues.push({
            id: `missing_profile_${user.id}`,
            type: 'missing_profile',
            severity: 'error',
            description: `User "${user.first_name} ${user.last_name}" (${user.email}) has role="therapist" but no therapist profile exists`,
            userId: user.id,
            userEmail: user.email,
            userName: `${user.first_name} ${user.last_name}`,
            currentRole: user.role,
            canAutoFix: false
          });
        }
      }

      // 2. Check for therapist profiles without auth accounts (NEW: uses auth_id)
      const { data: therapistProfiles, error: profilesError } = await supabaseClient
        .from('therapist_profiles')
        .select('id, user_id, auth_id, first_name, last_name, email');

      if (profilesError) throw profilesError;

      for (const profile of therapistProfiles || []) {
        // Check for auth_id (new system) - this is now the primary check
        if (!profile.auth_id) {
          foundIssues.push({
            id: `missing_auth_${profile.id}`,
            type: 'missing_user',
            severity: 'error',
            description: `Therapist "${profile.first_name} ${profile.last_name}" (${profile.email}) has no linked auth account (auth_id is null)`,
            therapistId: profile.id,
            userEmail: profile.email,
            userName: `${profile.first_name} ${profile.last_name}`,
            canAutoFix: false
          });
        } else {
          // Verify auth_id exists in auth.users
          const { data: authUser, error: authError } = await supabaseClient.auth.admin.getUserById(profile.auth_id);

          if (authError || !authUser?.user) {
            foundIssues.push({
              id: `orphaned_profile_${profile.id}`,
              type: 'missing_user',
              severity: 'error',
              description: `Therapist "${profile.first_name} ${profile.last_name}" has auth_id="${profile.auth_id}" but this auth user doesn't exist`,
              therapistId: profile.id,
              userId: profile.auth_id,
              userEmail: profile.email,
              userName: `${profile.first_name} ${profile.last_name}`,
              canAutoFix: false
            });
          }
        }

        // Legacy check: user_id (old system) - only check if populated
        if (profile.user_id) {
          const { data: user } = await supabaseClient
            .from('admin_users')
            .select('id, email, role')
            .eq('id', profile.user_id)
            .single();

          if (!user) {
            foundIssues.push({
              id: `orphaned_legacy_${profile.id}`,
              type: 'role_mismatch',
              severity: 'warning',
              description: `Therapist "${profile.first_name} ${profile.last_name}" has legacy user_id="${profile.user_id}" but this user doesn't exist (not critical if auth_id is set)`,
              therapistId: profile.id,
              userId: profile.user_id,
              userEmail: profile.email,
              userName: `${profile.first_name} ${profile.last_name}`,
              canAutoFix: false
            });
          } else if (user.role !== 'therapist') {
            foundIssues.push({
              id: `role_mismatch_${profile.id}`,
              type: 'role_mismatch',
              severity: 'warning',
              description: `Therapist "${profile.first_name} ${profile.last_name}" has legacy user with role="${user.role}" (expected "therapist")`,
              therapistId: profile.id,
              userId: user.id,
              userEmail: user.email,
              userName: `${profile.first_name} ${profile.last_name}`,
              currentRole: user.role,
              expectedRole: 'therapist',
              canAutoFix: true
            });
          }
        }
      }

      setIssues(foundIssues);
      setHasScanned(true);

      if (foundIssues.length === 0) {
        message.success('No sync issues found! All therapists and users are properly synced.');
      } else {
        message.warning(`Found ${foundIssues.length} sync issue(s) that need attention`);
      }
    } catch (error: any) {
      console.error('Error running sync check:', error);
      message.error('Failed to run sync check');
    } finally {
      setLoading(false);
    }
  };

  const fixRoleMismatch = async (issue: SyncIssue) => {
    if (!issue.userId) return;

    Modal.confirm({
      title: 'Fix Role Mismatch?',
      content: (
        <div>
          <p>Change user role from <Tag color="red">{issue.currentRole}</Tag> to <Tag color="green">{issue.expectedRole}</Tag>?</p>
          <p><strong>User:</strong> {issue.userName} ({issue.userEmail})</p>
        </div>
      ),
      okText: 'Yes, Fix Role',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const { error } = await supabaseClient
            .from('admin_users')
            .update({ role: issue.expectedRole })
            .eq('id', issue.userId);

          if (error) throw error;

          message.success('Role updated successfully');
          // Re-run sync check to refresh
          await runSyncCheck();
        } catch (error: any) {
          console.error('Error fixing role:', error);
          message.error('Failed to fix role mismatch');
        }
      }
    });
  };

  const columns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => (
        severity === 'error' ? (
          <Tag icon={<CloseCircleOutlined />} color="error">Error</Tag>
        ) : (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">Warning</Tag>
        )
      ),
    },
    {
      title: 'Issue Type',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: string) => {
        const typeLabels: Record<string, { label: string; color: string }> = {
          missing_profile: { label: 'Missing Profile', color: 'red' },
          missing_user: { label: 'Missing User', color: 'orange' },
          role_mismatch: { label: 'Role Mismatch', color: 'gold' }
        };
        const config = typeLabels[type] || { label: type, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: SyncIssue) => (
        <Space>
          {record.canAutoFix && record.type === 'role_mismatch' ? (
            <Button
              type="primary"
              size="small"
              onClick={() => fixRoleMismatch(record)}
            >
              Fix Role
            </Button>
          ) : (
            <Tooltip title="This issue requires manual intervention">
              <Button size="small" disabled>
                Manual Fix Required
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <RoleGuard requiredPermission="canManageUsers">
      <div style={{ padding: '24px' }}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={2}>
                <ToolOutlined /> System Tools
              </Title>
              <Text type="secondary">
                Utilities for maintaining system integrity and fixing data issues
              </Text>
            </div>

            <Card
              title={
                <Space>
                  <SyncOutlined />
                  <span>User & Therapist Sync Check</span>
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  onClick={runSyncCheck}
                  loading={loading}
                >
                  Run Sync Check
                </Button>
              }
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Alert
                  message="What does this check do?"
                  description={
                    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                      <li>Finds users with role="therapist" but no therapist profile</li>
                      <li>Finds therapist profiles with no linked user account</li>
                      <li>Finds therapist profiles linked to users with incorrect role</li>
                    </ul>
                  }
                  type="info"
                  showIcon
                />

                {loading && (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Spin size="large" />
                    <p style={{ marginTop: 16 }}>Scanning for sync issues...</p>
                  </div>
                )}

                {!loading && hasScanned && issues.length === 0 && (
                  <Alert
                    message="All Clear!"
                    description="No sync issues found. All therapists and users are properly synced."
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined />}
                  />
                )}

                {!loading && hasScanned && issues.length > 0 && (
                  <>
                    <Alert
                      message={`Found ${issues.length} Issue${issues.length > 1 ? 's' : ''}`}
                      description="Review the issues below and take appropriate action"
                      type="warning"
                      showIcon
                      icon={<WarningOutlined />}
                    />

                    <Table
                      columns={columns}
                      dataSource={issues}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                    />
                  </>
                )}
              </Space>
            </Card>
          </Space>
        </Card>
      </div>
    </RoleGuard>
  );
};

export default SystemTools;
