import React, { useState } from 'react';
import { Tabs, Card } from 'antd';
import {
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import CurrentWeekTab from './CurrentWeekTab';
import PendingInvoicesTab from './PendingInvoicesTab';
import WeeklySummaryTab from './WeeklySummaryTab';
import PaymentHistoryTab from './PaymentHistoryTab';

const { TabPane } = Tabs;

export const TherapistPayments: React.FC = () => {
  const [activeTab, setActiveTab] = useState('current-week');

  return (
    <div style={{ padding: '24px' }}>
      <style>{`
        .ant-tabs-tab:hover {
          color: #007e8c !important;
        }
        .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #007e8c !important;
        }
        .ant-tabs-ink-bar {
          background: #007e8c !important;
        }
      `}</style>
      <Card>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
            💰 Therapist Payments Management
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#666' }}>
            Track weekly earnings, process payments, and manage invoices
          </p>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
          <TabPane
            tab={
              <span>
                <ClockCircleOutlined />
                Current Week
              </span>
            }
            key="current-week"
          >
            <CurrentWeekTab />
          </TabPane>

          <TabPane
            tab={
              <span>
                <ExclamationCircleOutlined />
                Pending Invoices
              </span>
            }
            key="pending-invoices"
          >
            <PendingInvoicesTab />
          </TabPane>

          <TabPane
            tab={
              <span>
                <CalendarOutlined />
                Weekly Summary
              </span>
            }
            key="weekly-summary"
          >
            <WeeklySummaryTab />
          </TabPane>

          <TabPane
            tab={
              <span>
                <FileTextOutlined />
                Payment History
              </span>
            }
            key="payment-history"
          >
            <PaymentHistoryTab />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default TherapistPayments;
