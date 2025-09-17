import React from 'react';
import {
  Edit,
  useForm,
  useSelect,
} from '@refinedev/antd';
import {
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  TimePicker,
  Card,
  Row,
  Col,
  Divider,
  Tag,
  message,
} from 'antd';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

export const QuoteEdit: React.FC = () => {
  const { formProps, saveButtonProps, queryResult } = useForm({
    meta: {
      select: '*,quote_dates(*)',
    },
  });

  const quotesData = queryResult?.data?.data;

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Card title="Quote Information" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Quote ID"
                name="id"
              >
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[{ required: true, message: 'Please select a status' }]}
              >
                <Select>
                  <Option value="new">New</Option>
                  <Option value="sent">Sent</Option>
                  <Option value="accepted">Accepted</Option>
                  <Option value="declined">Declined</Option>
                  <Option value="invoiced">Invoiced</Option>
                  <Option value="paid">Paid</Option>
                  <Option value="completed">Completed</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Customer Information" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Company Name"
                name="company_name"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Customer Name"
                name="customer_name"
                rules={[{ required: true, message: 'Please enter customer name' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Email"
                name="customer_email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Phone"
                name="customer_phone"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Event Details" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Event Structure"
                name="event_structure"
                rules={[{ required: true, message: 'Please select event structure' }]}
              >
                <Select disabled>
                  <Option value="single_day">Single Day</Option>
                  <Option value="multi_day">Multi-Day</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Event Name"
                name="event_name"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                label="Event Location"
                name="event_location"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Form.Item
                label="Expected Attendees"
                name="expected_attendees"
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Urgency"
                name="urgency"
              >
                <Select>
                  <Option value="flexible">Flexible</Option>
                  <Option value="within_week">Within 1 Week</Option>
                  <Option value="within_3_days">Within 3 Days</Option>
                  <Option value="urgent_24h">Urgent (24h)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Payment Method"
                name="payment_method"
              >
                <Select>
                  <Option value="card">Credit Card</Option>
                  <Option value="invoice">Invoice</Option>
                  <Option value="bank_transfer">Bank Transfer</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Service Specifications" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Form.Item
                label="Total Sessions"
                name="total_sessions"
                rules={[{ required: true, message: 'Please enter total sessions' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Session Duration (minutes)"
                name="session_duration_minutes"
                rules={[{ required: true, message: 'Please enter session duration' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Therapists Needed"
                name="therapists_needed"
                rules={[{ required: true, message: 'Please enter number of therapists' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Financial Details" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Form.Item
                label="Hourly Rate ($)"
                name="hourly_rate"
                rules={[{ required: true, message: 'Please enter hourly rate' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Total Amount ($)"
                name="total_amount"
                rules={[{ required: true, message: 'Please enter total amount' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Therapist Fees ($)"
                name="total_therapist_fees"
                rules={[{ required: true, message: 'Please enter therapist fees' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Form.Item
                label="Discount Amount ($)"
                name="discount_amount"
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Tax Amount ($)"
                name="tax_rate_amount"
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Final Amount ($)"
                name="final_amount"
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Requirements" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Setup Requirements"
                name="setup_requirements"
              >
                <TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Special Requirements"
                name="special_requirements"
              >
                <TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                label="Discount Code"
                name="discount_code"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="PO Number"
                name="po_number"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Notes">
          <Form.Item
            label="Internal Notes"
            name="notes"
          >
            <TextArea rows={4} />
          </Form.Item>
        </Card>
      </Form>
    </Edit>
  );
};