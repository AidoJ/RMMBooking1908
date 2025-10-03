import React, { useEffect, useState } from 'react';
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Switch,
  Button,
  Card,
  Typography,
  Row,
  Col,
  message,
  Space,
  Divider,
  Alert,
  Spin,
  Radio,
  Checkbox,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, GiftOutlined, CreditCardOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Load Stripe - using environment variable only (NO hardcoded keys!)
const stripePromise = import.meta.env.STRIPE_PUBLISHABLE_KEY ? loadStripe(import.meta.env.STRIPE_PUBLISHABLE_KEY) : null;

// Card element styling to match Ant Design
const cardElementOptions = {
  style: {
    base: {
      fontSize: '14px',
      color: '#000000d9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      '::placeholder': {
        color: '#00000040',
      },
    },
    invalid: {
      color: '#ff4d4f',
      iconColor: '#ff4d4f',
    },
  },
  hidePostalCode: false,
};

const GiftCardPaymentForm: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const { list } = useNavigation();
  const stripe = useStripe();
  const elements = useElements();

  const generateCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'GC-';
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    form.setFieldValue('code', result);
  };
  
  // Load EmailJS service
  const loadEmailService = async () => {
    return new Promise((resolve, reject) => {
      if (window.EmailService) {
        resolve(window.EmailService);
        return;
      }
      
      // Create script elements for EmailJS
      const emailjsScript = document.createElement('script');
      emailjsScript.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
      emailjsScript.onload = () => {
        // Load email service script
        const serviceScript = document.createElement('script');
        serviceScript.src = '/js/emailService.js';
        serviceScript.onload = () => {
          if (window.EmailService) {
            resolve(window.EmailService);
          } else {
            reject(new Error('EmailService failed to load'));
          }
        };
        serviceScript.onerror = () => reject(new Error('Failed to load email service script'));
        document.head.appendChild(serviceScript);
      };
      emailjsScript.onerror = () => reject(new Error('Failed to load EmailJS'));
      document.head.appendChild(emailjsScript);
    });
  };

  const processPayment = async (giftCardData: any): Promise<{ success: boolean; paymentData?: any; error?: string }> => {
    if (!stripe || !elements) {
      return { success: false, error: 'Stripe not loaded' };
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      return { success: false, error: 'Card element not found' };
    }

    try {
      // Create payment intent
      const response = await fetch('/.netlify/functions/create-gift-card-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: giftCardData.initial_balance,
          currency: 'aud',
          giftCardData: {
            code: giftCardData.code,
            card_holder_name: giftCardData.card_holder_name,
            card_holder_email: giftCardData.card_holder_email,
            card_holder_phone: giftCardData.card_holder_phone,
            recipient_name: giftCardData.recipient_name,
            recipient_email: giftCardData.recipient_email,
            purchaser_name: giftCardData.purchaser_name,
            purchaser_email: giftCardData.purchaser_email,
          },
        }),
      });

      const { client_secret, payment_intent_id, customer_id, error } = await response.json();

      if (error) {
        return { success: false, error };
      }

      // Confirm payment
      const { error: paymentError, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: giftCardData.card_holder_name,
            email: giftCardData.card_holder_email,
            phone: giftCardData.card_holder_phone,
          },
        },
      });

      if (paymentError) {
        return { success: false, error: paymentError.message };
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        return {
          success: true,
          paymentData: {
            payment_intent_id: paymentIntent.id,
            stripe_customer_id: customer_id,
            payment_method: `card ****0000`, // Will be updated with actual details from webhook if needed
            transaction_fee: 0, // Will be updated from webhook if needed
            payment_date: new Date().toISOString(),
            payment_status: 'completed',
          },
        };
      }

      return { success: false, error: 'Payment failed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    setPaymentProcessing(true);

    try {
      const giftCardData = {
        code: values.code.toUpperCase(),
        initial_balance: values.initial_balance,
        current_balance: values.initial_balance,
        purchaser_name: values.purchaser_name || null,
        purchaser_email: values.purchaser_email || null,
        recipient_name: values.recipient_name || null,
        recipient_email: values.recipient_email || null,
        message: values.message || null,
        expires_at: values.expires_at ? values.expires_at.toISOString() : null,
        is_active: values.is_active ?? true,
        card_holder_name: values.card_holder_name,
        card_holder_email: values.card_holder_email,
        card_holder_phone: values.card_holder_phone || null,
      };

      // Process payment first
      const paymentResult = await processPayment(giftCardData);
      
      if (!paymentResult.success) {
        message.error(`Payment failed: ${paymentResult.error}`);
        return;
      }

      // Payment successful, now create gift card record
      const finalGiftCardData = {
        ...giftCardData,
        ...paymentResult.paymentData,
      };

      const { error } = await supabaseClient
        .from('gift_cards')
        .insert([finalGiftCardData]);

      if (error) throw error;

      message.success('Gift card created and payment processed successfully!');
      
      // Send email if requested
      const shouldSendEmail = values.send_email;
      const sendToRecipient = values.email_recipient === 'recipient';
      
      if (shouldSendEmail) {
        setEmailSending(true);
        try {
          // Load EmailJS script if not already loaded
          if (!window.EmailService) {
            await loadEmailService();
          }
          
          const emailResult = await window.EmailService.sendGiftCardEmail(finalGiftCardData, sendToRecipient);
          
          if (emailResult.success) {
            message.success(`Email sent successfully to ${emailResult.sentTo}`);
          } else {
            message.warning(`Gift card created but email failed: ${emailResult.error}`);
          }
        } catch (error) {
          console.error('Email sending error:', error);
          message.warning('Gift card created but email could not be sent');
        } finally {
          setEmailSending(false);
        }
      }
      
      list('gift_cards');
    } catch (error) {
      console.error('Error creating gift card:', error);
      message.error('Failed to create gift card after payment. Please contact support.');
    } finally {
      setLoading(false);
      setPaymentProcessing(false);
    }
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />}
              onClick={() => list('gift_cards')}
            >
              Back to Gift Cards
            </Button>
            <Title level={2} style={{ margin: 0 }}>Create New Gift Card</Title>
          </Space>
        </Col>
      </Row>

      {paymentProcessing && (
        <Alert
          message="Processing Payment"
          description="Please wait while we process the payment. Do not refresh or close this page."
          type="info"
          icon={<Spin />}
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            is_active: true,
            send_email: true,
            email_recipient: 'purchaser',
          }}
        >
          {/* Gift Card Details */}
          <Title level={4}>
            <GiftOutlined /> Gift Card Details
          </Title>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="Gift Card Code"
                name="code"
                rules={[
                  { required: true, message: 'Please enter gift card code' },
                  { min: 5, message: 'Code must be at least 5 characters' },
                  { max: 30, message: 'Code must be less than 30 characters' }
                ]}
                extra={
                  <Button type="link" onClick={generateCode} style={{ padding: 0 }}>
                    Generate Random Code
                  </Button>
                }
              >
                <Input 
                  placeholder="Enter gift card code"
                  style={{ textTransform: 'uppercase' }}
                  onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Gift Card Value"
                name="initial_balance"
                rules={[
                  { required: true, message: 'Please enter gift card value' },
                  { type: 'number', min: 1, message: 'Value must be at least $1' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={10000}
                  precision={2}
                  placeholder="Enter amount"
                  addonBefore="$"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Expiry Date (Optional)"
            name="expires_at"
          >
            <DatePicker
              style={{ width: '100%' }}
              showTime
              format="DD/MM/YYYY HH:mm"
              placeholder="Select expiry date (leave empty for no expiry)"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>

          <Divider />

          {/* Card Holder Information (Required for Payment) */}
          <Title level={4}>
            <CreditCardOutlined /> Card Holder Information
          </Title>
          
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                label="Card Holder Name"
                name="card_holder_name"
                rules={[
                  { required: true, message: 'Please enter card holder name' }
                ]}
              >
                <Input placeholder="Enter name on card" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Card Holder Email"
                name="card_holder_email"
                rules={[
                  { required: true, message: 'Please enter card holder email' },
                  { type: 'email', message: 'Please enter valid email address' }
                ]}
              >
                <Input placeholder="Enter email address" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Card Holder Phone"
                name="card_holder_phone"
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          {/* Payment Information */}
          <Title level={4}>
            <LockOutlined /> Payment Information
          </Title>
          
          <Alert
            message="Secure Payment Processing"
            description="Payment information is processed securely through Stripe. Card details are never stored on our servers."
            type="info"
            icon={<LockOutlined />}
            style={{ marginBottom: 16 }}
          />

          <div style={{ 
            padding: '16px', 
            border: '1px solid #d9d9d9', 
            borderRadius: '6px',
            backgroundColor: '#fafafa'
          }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Card Details</Text>
            <CardElement options={cardElementOptions} />
          </div>

          <Divider />

          {/* Purchaser Information */}
          <Title level={4}>Purchaser Information (Optional)</Title>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="Purchaser Name"
                name="purchaser_name"
              >
                <Input placeholder="Enter purchaser's name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Purchaser Email"
                name="purchaser_email"
                rules={[
                  { type: 'email', message: 'Please enter valid email address' }
                ]}
              >
                <Input placeholder="Enter purchaser's email" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          {/* Recipient Information */}
          <Title level={4}>Recipient Information (Optional)</Title>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="Recipient Name"
                name="recipient_name"
              >
                <Input placeholder="Enter recipient's name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Recipient Email"
                name="recipient_email"
                rules={[
                  { type: 'email', message: 'Please enter valid email address' }
                ]}
              >
                <Input placeholder="Enter recipient's email" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Personal Message"
            name="message"
          >
            <TextArea
              rows={4}
              placeholder="Enter a personal message for the recipient (optional)"
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="Status"
            name="is_active"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Active"
              unCheckedChildren="Inactive"
            />
          </Form.Item>

          <Divider />

          {/* Email Options */}
          <Title level={4}>
            <MailOutlined /> Email Delivery Options
          </Title>
          
          <Form.Item
            name="send_email"
            valuePropName="checked"
          >
            <Checkbox>
              Send gift card email after creation
            </Checkbox>
          </Form.Item>

          <Form.Item
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.send_email !== currentValues.send_email
            }
          >
            {({ getFieldValue }) => {
              const sendEmail = getFieldValue('send_email');
              
              if (!sendEmail) return null;
              
              return (
                <>
                  <Form.Item
                    label="Send Email To"
                    name="email_recipient"
                    rules={[
                      { required: true, message: 'Please select email recipient' }
                    ]}
                  >
                    <Radio.Group>
                      <Radio value="purchaser">Card Holder/Purchaser</Radio>
                      <Radio value="recipient">Recipient (if specified)</Radio>
                    </Radio.Group>
                  </Form.Item>
                  
                  <Alert
                    message="Email Delivery Information"
                    description={
                      <div>
                        <p><strong>Card Holder/Purchaser:</strong> Sends to the person who paid for the card. Perfect for gifts where they want to print or forward the email themselves.</p>
                        <p><strong>Recipient:</strong> Sends directly to the gift recipient (only available if recipient email is provided). Use this for direct delivery surprise gifts.</p>
                      </div>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                </>
              );
            }}
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={loading || emailSending}
                disabled={!stripe || paymentProcessing || emailSending}
                icon={<SaveOutlined />}
                size="large"
              >
                {paymentProcessing ? 'Processing Payment...' : emailSending ? 'Sending Email...' : 'Create Gift Card & Process Payment'}
              </Button>
              <Button 
                size="large" 
                onClick={() => list('gift_cards')}
                disabled={paymentProcessing || emailSending}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

// Main component wrapped with Stripe Elements
const GiftCardsCreate: React.FC = () => {
  const [stripeReady, setStripeReady] = useState(false);

  useEffect(() => {
    // Check if Stripe key is available from environment
    if (import.meta.env.STRIPE_PUBLISHABLE_KEY) {
      setStripeReady(true);
    } else {
      message.error('Stripe configuration missing. Please ensure STRIPE_PUBLISHABLE_KEY environment variable is set.');
    }
  }, []);

  if (!stripeReady) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading payment system...</div>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h3>Payment system unavailable</h3>
        <p>Stripe configuration is missing. Please contact your administrator.</p>
        <Button onClick={() => window.location.href = '/admin/gift-cards'}>
          Back to Gift Cards
        </Button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <GiftCardPaymentForm />
    </Elements>
  );
};

export default GiftCardsCreate;