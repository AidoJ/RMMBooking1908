import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Modal,
  message,
  Tooltip,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Input,
} from 'antd';
import {
  HistoryOutlined,
  UserOutlined,
  EyeOutlined,
  RollbackOutlined,
  FilterOutlined,
  ExportOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { supabaseClient } from '../utility';
import { UserIdentity } from '../utils/roleUtils';
import dayjs, { Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

interface AuditLogEntry {
  id: string;
  setting_key: string;
  old_value: string | null;
  new_value: string;
  changed_by: string;
  changed_by_name?: string;
  changed_at: string;
  reason?: string;
  ip_address?: string;
  user_agent?: string;
}

interface SettingsAuditLogProps {
  visible: boolean;
  onClose: () => void;
  settingKey?: string; // Filter by specific setting if provided
}

export const SettingsAuditLog: React.FC<SettingsAuditLogProps> = ({
  visible,
  onClose,
  settingKey
}) => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterSetting, setFilterSetting] = useState<string>(settingKey || 'all');
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');

  useEffect(() => {
    if (visible) {
      loadAuditLogs();
    }
  }, [visible]);

  useEffect(() => {
    applyFilters();
  }, [auditLogs, dateRange, filterUser, filterSetting]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      
      // For now, we'll simulate audit log data since the table might not exist yet
      // In production, this would query a real audit table
      const mockAuditLogs: AuditLogEntry[] = [
        {
          id: '1',
          setting_key: 'global_service_base_price',
          old_value: '85.00',
          new_value: '90.00',
          changed_by: identity?.id || 'admin',
          changed_by_name: `${identity?.first_name || 'Admin'} ${identity?.last_name || 'User'}`,
          changed_at: dayjs().subtract(2, 'days').toISOString(),
          reason: 'Price increase due to market conditions',
        },
        {
          id: '2',
          setting_key: 'enable_weekend_bookings',
          old_value: 'false',
          new_value: 'true',
          changed_by: identity?.id || 'admin',
          changed_by_name: `${identity?.first_name || 'Admin'} ${identity?.last_name || 'User'}`,
          changed_at: dayjs().subtract(5, 'days').toISOString(),
          reason: 'Enable weekend services for increased availability',
        },
        {
          id: '3',
          setting_key: 'max_booking_advance_days',
          old_value: '14',
          new_value: '30',
          changed_by: identity?.id || 'admin',
          changed_by_name: `${identity?.first_name || 'Admin'} ${identity?.last_name || 'User'}`,
          changed_at: dayjs().subtract(1, 'week').toISOString(),
          reason: 'Extended booking window for better planning',
        },
      ];

      // TODO: Replace with actual database query
      // const { data, error } = await supabaseClient
      //   .from('settings_audit_log')
      //   .select(`
      //     *,
      //     admin_users(first_name, last_name, email)
      //   `)
      //   .order('changed_at', { ascending: false })
      //   .limit(100);

      setAuditLogs(mockAuditLogs);
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      message.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...auditLogs];

    // Filter by date range
    if (dateRange && dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(log => {
        const logDate = dayjs(log.changed_at);
        return logDate.isAfter(dateRange[0]) && logDate.isBefore(dateRange[1]);
      });
    }

    // Filter by user
    if (filterUser !== 'all') {
      filtered = filtered.filter(log => log.changed_by === filterUser);
    }

    // Filter by setting
    if (filterSetting !== 'all') {
      filtered = filtered.filter(log => log.setting_key === filterSetting);
    }

    setFilteredLogs(filtered);
  };

  const handleRollback = async () => {
    if (!selectedEntry || !rollbackReason.trim()) {
      message.error('Please provide a reason for the rollback');
      return;
    }

    try {
      // Update the setting back to old value
      const { error } = await supabaseClient
        .from('system_settings')
        .update({
          value: selectedEntry.old_value,
          updated_at: new Date().toISOString(),
        })
        .eq('key', selectedEntry.setting_key);

      if (error) throw error;

      // TODO: Add audit log entry for the rollback
      // const auditEntry = {
      //   setting_key: selectedEntry.setting_key,
      //   old_value: selectedEntry.new_value,
      //   new_value: selectedEntry.old_value,
      //   changed_by: identity?.id,
      //   reason: `Rollback: ${rollbackReason}`,
      //   changed_at: new Date().toISOString(),
      // };

      message.success('Setting rolled back successfully');
      setRollbackModalVisible(false);
      setRollbackReason('');
      setSelectedEntry(null);
      loadAuditLogs();
    } catch (error: any) {
      console.error('Error rolling back setting:', error);
      message.error('Failed to rollback setting');
    }
  };

  const exportAuditLogs = () => {
    const csvContent = [
      ['Setting Key', 'Old Value', 'New Value', 'Changed By', 'Changed At', 'Reason'].join(','),
      ...filteredLogs.map(log => [
        log.setting_key,
        log.old_value || '',
        log.new_value,
        log.changed_by_name || log.changed_by,
        dayjs(log.changed_at).format('YYYY-MM-DD HH:mm:ss'),
        log.reason || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `settings-audit-log-${dayjs().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Audit logs exported successfully');
  };

  const getValueDisplay = (value: string | null, settingKey: string) => {
    if (value === null) return <Text type="secondary">Not set</Text>;
    
    // Format different types of values
    if (settingKey.includes('price') || settingKey.includes('fee')) {
      return <Text strong style={{ color: '#52c41a' }}>${parseFloat(value).toFixed(2)}</Text>;
    }
    if (settingKey.includes('rate') && parseFloat(value) < 1) {
      return <Text>{(parseFloat(value) * 100).toFixed(1)}%</Text>;
    }
    if (value === 'true' || value === 'false') {
      return <Tag color={value === 'true' ? 'green' : 'red'}>{value.toUpperCase()}</Tag>;
    }
    return <Text>{value}</Text>;
  };

  const columns = [
    {
      title: 'Setting',
      dataIndex: 'setting_key',
      key: 'setting_key',
      width: 200,
      render: (key: string) => (
        <Text code style={{ fontSize: '12px' }}>{key}</Text>
      )
    },
    {
      title: 'Change',
      key: 'change',
      width: 300,
      render: (_: any, record: AuditLogEntry) => (
        <Space direction="vertical" size="small">
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>From: </Text>
            {getValueDisplay(record.old_value, record.setting_key)}
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>To: </Text>
            {getValueDisplay(record.new_value, record.setting_key)}
          </div>
        </Space>
      )
    },
    {
      title: 'Changed By',
      key: 'changed_by',
      width: 150,
      render: (_: any, record: AuditLogEntry) => (
        <Space>
          <UserOutlined />
          <Text>{record.changed_by_name || record.changed_by}</Text>
        </Space>
      )
    },
    {
      title: 'When',
      dataIndex: 'changed_at',
      key: 'changed_at',
      width: 120,
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <Text>{dayjs(date).fromNow()}</Text>
        </Tooltip>
      )
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (reason: string) => reason ? <Text>{reason}</Text> : <Text type="secondary">No reason provided</Text>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: AuditLogEntry) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                Modal.info({
                  title: 'Audit Log Details',
                  width: 600,
                  content: (
                    <div style={{ marginTop: 16 }}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Text strong>Setting Key:</Text>
                          <div><Text code>{record.setting_key}</Text></div>
                        </Col>
                        <Col span={12}>
                          <Text strong>Changed At:</Text>
                          <div><Text>{dayjs(record.changed_at).format('YYYY-MM-DD HH:mm:ss')}</Text></div>
                        </Col>
                      </Row>
                      <Row gutter={16} style={{ marginTop: 16 }}>
                        <Col span={12}>
                          <Text strong>Old Value:</Text>
                          <div>{getValueDisplay(record.old_value, record.setting_key)}</div>
                        </Col>
                        <Col span={12}>
                          <Text strong>New Value:</Text>
                          <div>{getValueDisplay(record.new_value, record.setting_key)}</div>
                        </Col>
                      </Row>
                      {record.reason && (
                        <div style={{ marginTop: 16 }}>
                          <Text strong>Reason:</Text>
                          <div style={{ marginTop: 4, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                            <Text>{record.reason}</Text>
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                });
              }}
            />
          </Tooltip>
          {record.old_value && (
            <Tooltip title="Rollback to Previous Value">
              <Button
                size="small"
                icon={<RollbackOutlined />}
                onClick={() => {
                  setSelectedEntry(record);
                  setRollbackModalVisible(true);
                }}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <>
      <Modal
        title={<><HistoryOutlined /> Settings Audit Log</>}
        open={visible}
        onCancel={onClose}
        width={1200}
        footer={null}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic title="Total Changes" value={auditLogs.length} />
            </Col>
            <Col span={6}>
              <Statistic 
                title="This Week" 
                value={auditLogs.filter(log => dayjs(log.changed_at).isAfter(dayjs().subtract(1, 'week'))).length} 
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="Last 24h" 
                value={auditLogs.filter(log => dayjs(log.changed_at).isAfter(dayjs().subtract(1, 'day'))).length} 
              />
            </Col>
            <Col span={6}>
              <Space>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={loadAuditLogs}
                  loading={loading}
                >
                  Refresh
                </Button>
                <Button 
                  icon={<ExportOutlined />} 
                  onClick={exportAuditLogs}
                  disabled={filteredLogs.length === 0}
                >
                  Export
                </Button>
              </Space>
            </Col>
          </Row>

          {/* Filters */}
          <Card size="small" title={<><FilterOutlined /> Filters</>}>
            <Row gutter={16}>
              <Col span={8}>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>Date Range:</Text>
                <RangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col span={8}>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>Setting:</Text>
                <Select
                  value={filterSetting}
                  onChange={setFilterSetting}
                  style={{ width: '100%' }}
                >
                  <Option value="all">All Settings</Option>
                  {[...new Set(auditLogs.map(log => log.setting_key))].map(key => (
                    <Option key={key} value={key}>{key}</Option>
                  ))}
                </Select>
              </Col>
              <Col span={8}>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>User:</Text>
                <Select
                  value={filterUser}
                  onChange={setFilterUser}
                  style={{ width: '100%' }}
                >
                  <Option value="all">All Users</Option>
                  {[...new Set(auditLogs.map(log => log.changed_by))].map(userId => {
                    const userName = auditLogs.find(log => log.changed_by === userId)?.changed_by_name || userId;
                    return <Option key={userId} value={userId}>{userName}</Option>;
                  })}
                </Select>
              </Col>
            </Row>
          </Card>
        </div>

        <Table
          columns={columns}
          dataSource={filteredLogs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} changes`,
          }}
          scroll={{ y: 400 }}
        />
      </Modal>

      {/* Rollback Modal */}
      <Modal
        title="Rollback Setting"
        open={rollbackModalVisible}
        onCancel={() => {
          setRollbackModalVisible(false);
          setRollbackReason('');
          setSelectedEntry(null);
        }}
        onOk={handleRollback}
        okText="Rollback"
        okType="danger"
      >
        {selectedEntry && (
          <div>
            <p>
              Are you sure you want to rollback <Text code>{selectedEntry.setting_key}</Text> from{' '}
              <Text strong>{selectedEntry.new_value}</Text> to{' '}
              <Text strong>{selectedEntry.old_value}</Text>?
            </p>
            <Text strong style={{ marginBottom: 8, display: 'block' }}>
              Reason for rollback (required):
            </Text>
            <TextArea
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              placeholder="Please provide a reason for this rollback..."
              rows={3}
              maxLength={500}
              showCount
            />
          </div>
        )}
      </Modal>
    </>
  );
};