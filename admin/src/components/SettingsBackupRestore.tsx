import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Upload,
  Modal,
  Typography,
  Alert,
  Divider,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Input,
} from 'antd';
import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  ExclamationCircleOutlined,
  SaveOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { supabaseClient } from '../utility';
import { UserIdentity } from '../utils/roleUtils';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface BackupData {
  version: string;
  timestamp: string;
  created_by: string;
  settings: Array<{
    key: string;
    value: string;
    category?: string;
    description?: string;
  }>;
  metadata: {
    total_settings: number;
    platform_version: string;
    backup_type: 'full' | 'partial';
  };
}

interface SettingsBackupRestoreProps {
  visible: boolean;
  onClose: () => void;
  onSettingsUpdated?: () => void;
}

export const SettingsBackupRestore: React.FC<SettingsBackupRestoreProps> = ({
  visible,
  onClose,
  onSettingsUpdated
}) => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const [loading, setLoading] = useState(false);
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [backupReason, setBackupReason] = useState('');

  const createBackup = async () => {
    try {
      setLoading(true);

      // Fetch all current settings
      const { data: settings, error } = await supabaseClient
        .from('system_settings')
        .select('*')
        .order('key');

      if (error) throw error;

      const backup: BackupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        created_by: `${identity?.first_name || ''} ${identity?.last_name || ''}`.trim() || identity?.email || 'Unknown',
        settings: settings?.map(setting => ({
          key: setting.key,
          value: setting.value,
          category: setting.category || 'general',
          description: setting.description || '',
        })) || [],
        metadata: {
          total_settings: settings?.length || 0,
          platform_version: '1.0.0',
          backup_type: 'full',
        }
      };

      // Create downloadable backup file
      const backupJson = JSON.stringify(backup, null, 2);
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `system-settings-backup-${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // TODO: Also store backup in database for history
      // const { error: backupError } = await supabaseClient
      //   .from('settings_backups')
      //   .insert({
      //     backup_data: backup,
      //     created_by: identity?.id,
      //     reason: backupReason || 'Manual backup',
      //   });

      message.success('Settings backup created and downloaded successfully');
      setBackupReason('');
      
    } catch (error: any) {
      console.error('Error creating backup:', error);
      message.error('Failed to create settings backup');
    } finally {
      setLoading(false);
    }
  };

  const validateBackupFile = (file: File): Promise<BackupData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const backup = JSON.parse(content) as BackupData;
          
          // Validate backup structure
          if (!backup.version || !backup.timestamp || !backup.settings || !Array.isArray(backup.settings)) {
            reject(new Error('Invalid backup file format'));
            return;
          }

          // Validate settings structure
          const validSettings = backup.settings.every(setting => 
            setting.key && typeof setting.value === 'string'
          );

          if (!validSettings) {
            reject(new Error('Invalid settings format in backup file'));
            return;
          }

          resolve(backup);
        } catch (error) {
          reject(new Error('Failed to parse backup file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read backup file'));
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    try {
      setLoading(true);
      const backup = await validateBackupFile(file);
      setBackupData(backup);
      setRestoreModalVisible(true);
      return false; // Prevent default upload behavior
    } catch (error: any) {
      message.error(error.message || 'Invalid backup file');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const performRestore = async () => {
    if (!backupData) return;

    try {
      setLoading(true);

      // Get current settings for comparison
      const { data: currentSettings } = await supabaseClient
        .from('system_settings')
        .select('key, value');

      const currentSettingsMap = new Map(
        currentSettings?.map(s => [s.key, s.value]) || []
      );

      // Prepare updates
      const updates = [];
      const inserts = [];

      for (const setting of backupData.settings) {
        if (currentSettingsMap.has(setting.key)) {
          // Update existing setting
          if (currentSettingsMap.get(setting.key) !== setting.value) {
            updates.push({
              key: setting.key,
              value: setting.value,
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          // Insert new setting
          inserts.push({
            key: setting.key,
            value: setting.value,
            category: setting.category || 'general',
            data_type: 'string', // Default type
            description: setting.description || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      // Perform updates
      for (const update of updates) {
        const { error } = await supabaseClient
          .from('system_settings')
          .update({
            value: update.value,
            updated_at: update.updated_at,
          })
          .eq('key', update.key);

        if (error) throw error;
      }

      // Perform inserts
      if (inserts.length > 0) {
        const { error } = await supabaseClient
          .from('system_settings')
          .insert(inserts);

        if (error) throw error;
      }

      // TODO: Log the restore operation
      // const auditEntry = {
      //   action: 'settings_restore',
      //   details: {
      //     backup_timestamp: backupData.timestamp,
      //     settings_updated: updates.length,
      //     settings_created: inserts.length,
      //   },
      //   performed_by: identity?.id,
      //   performed_at: new Date().toISOString(),
      // };

      message.success(`Settings restored successfully! Updated ${updates.length} settings, created ${inserts.length} new settings.`);
      
      setRestoreModalVisible(false);
      setBackupData(null);
      onClose();
      onSettingsUpdated?.();
      
    } catch (error: any) {
      console.error('Error restoring settings:', error);
      message.error('Failed to restore settings');
    } finally {
      setLoading(false);
    }
  };

  const getSettingsPreview = () => {
    if (!backupData) return [];

    return backupData.settings.map(setting => ({
      key: setting.key,
      setting_key: setting.key,
      value: setting.value,
      category: setting.category || 'general',
      description: setting.description || 'No description',
    }));
  };

  const previewColumns = [
    {
      title: 'Setting Key',
      dataIndex: 'setting_key',
      key: 'setting_key',
      width: 200,
      render: (key: string) => <Text code style={{ fontSize: '12px' }}>{key}</Text>
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: 150,
      ellipsis: true,
      render: (value: string) => {
        if (value === 'true' || value === 'false') {
          return <Tag color={value === 'true' ? 'green' : 'red'}>{value.toUpperCase()}</Tag>;
        }
        return <Text>{value}</Text>;
      }
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => (
        <Tag color="blue">{category}</Tag>
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    }
  ];

  return (
    <>
      <Modal
        title={<><CloudDownloadOutlined /> Backup & Restore Settings</>}
        open={visible}
        onCancel={onClose}
        width={800}
        footer={null}
        destroyOnClose
      >
        <div style={{ marginBottom: 24 }}>
          <Alert
            message="Settings Backup & Restore"
            description="Create backups of your system settings to protect against accidental changes or to migrate settings between environments."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={24}>
            {/* Create Backup */}
            <Col span={12}>
              <Card title="Create Backup" size="small">
                <Paragraph style={{ fontSize: '14px', marginBottom: 16 }}>
                  Download a complete backup of all current system settings as a JSON file.
                </Paragraph>
                
                <TextArea
                  placeholder="Optional: Reason for creating this backup..."
                  value={backupReason}
                  onChange={(e) => setBackupReason(e.target.value)}
                  rows={3}
                  style={{ marginBottom: 16 }}
                />

                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={createBackup}
                  loading={loading}
                  block
                  size="large"
                >
                  Create Backup
                </Button>
              </Card>
            </Col>

            {/* Restore from Backup */}
            <Col span={12}>
              <Card title="Restore from Backup" size="small">
                <Paragraph style={{ fontSize: '14px', marginBottom: 16 }}>
                  Upload and restore settings from a previously created backup file.
                </Paragraph>

                <Upload.Dragger
                  accept=".json"
                  multiple={false}
                  beforeUpload={handleFileUpload}
                  showUploadList={false}
                  style={{ marginBottom: 16 }}
                >
                  <p className="ant-upload-drag-icon">
                    <CloudUploadOutlined style={{ fontSize: '24px' }} />
                  </p>
                  <p className="ant-upload-text">Click or drag backup file to this area</p>
                  <p className="ant-upload-hint">Only JSON backup files are supported</p>
                </Upload.Dragger>

                <Alert
                  message="⚠️ Restore will overwrite current settings"
                  type="warning"
                />
              </Card>
            </Col>
          </Row>
        </div>
      </Modal>

      {/* Restore Preview Modal */}
      <Modal
        title="Restore Settings Preview"
        open={restoreModalVisible}
        onCancel={() => {
          setRestoreModalVisible(false);
          setBackupData(null);
        }}
        width={1000}
        footer={[
          <Button key="cancel" onClick={() => setRestoreModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="restore"
            type="primary"
            danger
            icon={<CloudUploadOutlined />}
            onClick={performRestore}
            loading={loading}
          >
            Restore Settings
          </Button>
        ]}
      >
        {backupData && (
          <div>
            <Alert
              message="⚠️ Warning: This will overwrite your current settings"
              description="This action cannot be undone. Make sure you have a backup of your current settings before proceeding."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic title="Backup Date" value={dayjs(backupData.timestamp).format('YYYY-MM-DD HH:mm')} />
              </Col>
              <Col span={6}>
                <Statistic title="Created By" value={backupData.created_by} />
              </Col>
              <Col span={6}>
                <Statistic title="Total Settings" value={backupData.metadata.total_settings} />
              </Col>
              <Col span={6}>
                <Statistic title="Backup Version" value={backupData.version} />
              </Col>
            </Row>

            <Divider />

            <Title level={5}>Settings to be Restored:</Title>
            <Table
              columns={previewColumns}
              dataSource={getSettingsPreview()}
              rowKey="key"
              pagination={{
                pageSize: 10,
                size: 'small',
              }}
              scroll={{ y: 300 }}
              size="small"
            />
          </div>
        )}
      </Modal>
    </>
  );
};