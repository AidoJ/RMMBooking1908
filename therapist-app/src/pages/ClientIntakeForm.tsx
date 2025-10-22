import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Button, Checkbox, Radio, DatePicker, InputNumber, message, Spin, Alert, Typography, Space, Divider, Row, Col } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { supabaseClient } from '../services/supabaseClient';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface IntakeFormData {
  booking_id: string;
  has_medications: boolean;
  medications: string | null;
  has_allergies: boolean;
  allergies: string | null;
  is_pregnant: boolean;
  pregnancy_months: number | null;
  pregnancy_due_date: string | null;
  has_medical_supervision: boolean;
  medical_supervision_details: string | null;
  medical_conditions: string[];
  has_broken_skin: boolean;
  broken_skin_location: string | null;
  has_joint_replacement: boolean;
  joint_replacement_details: string | null;
  has_recent_injuries: boolean;
  recent_injuries: string | null;
  has_other_conditions: boolean;
  other_conditions: string | null;
  signature_data: string | null;
  completed_at: string;
}

const medicalConditionsList = [
  'Heart Condition',
  'High Blood Pressure',
  'Low Blood Pressure',
  'Diabetes',
  'Arthritis',
  'Osteoporosis',
  'Cancer',
  'Epilepsy',
  'Asthma',
  'Allergies',
  'Varicose Veins',
  'Deep Vein Thrombosis',
  'Fibromyalgia',
  'Chronic Fatigue',
  'Migraines',
  'Skin Conditions',
  'Recent Surgery',
  'Infectious Disease',
  'Mental Health Condition',
  'Neurological Condition',
  'Respiratory Condition',
  'Digestive Issues',
  'Other'
];

export function ClientIntakeForm() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking');

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingInfo, setBookingInfo] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Form state for conditional fields
  const [hasMedications, setHasMedications] = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [isPregnant, setIsPregnant] = useState(false);
  const [hasMedicalSupervision, setHasMedicalSupervision] = useState(false);
  const [hasBrokenSkin, setHasBrokenSkin] = useState(false);
  const [hasJointReplacement, setHasJointReplacement] = useState(false);
  const [hasRecentInjuries, setHasRecentInjuries] = useState(false);
  const [hasOtherConditions, setHasOtherConditions] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided. Please use the link from your confirmation email.');
      setLoading(false);
      return;
    }

    loadBookingData();
  }, [bookingId]);

  useEffect(() => {
    // Initialize signature canvas
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 200;

    // Configure drawing style
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  async function loadBookingData() {
    try {
      // Check if form already submitted
      const { data: existingForm, error: formError } = await supabaseClient
        .from('client_intake_forms')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (formError && formError.code !== 'PGRST116') {
        throw formError;
      }

      if (existingForm && existingForm.completed_at) {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      // Fetch booking details
      const { data: booking, error: bookingError } = await supabaseClient
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;
      if (!booking) {
        setError('Booking not found. Please check your link and try again.');
        setLoading(false);
        return;
      }

      setBookingInfo(booking);

      // Load existing form data if available
      if (existingForm) {
        loadExistingFormData(existingForm);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading booking data:', err);
      setError('Failed to load booking information. Please try again later.');
      setLoading(false);
    }
  }

  function loadExistingFormData(formData: any) {
    form.setFieldsValue({
      has_medications: formData.has_medications,
      medications: formData.medications,
      has_allergies: formData.has_allergies,
      allergies: formData.allergies,
      is_pregnant: formData.is_pregnant,
      pregnancy_months: formData.pregnancy_months,
      pregnancy_due_date: formData.pregnancy_due_date,
      has_medical_supervision: formData.has_medical_supervision,
      medical_supervision_details: formData.medical_supervision_details,
      medical_conditions: formData.medical_conditions || [],
      has_broken_skin: formData.has_broken_skin,
      broken_skin_location: formData.broken_skin_location,
      has_joint_replacement: formData.has_joint_replacement,
      joint_replacement_details: formData.joint_replacement_details,
      has_recent_injuries: formData.has_recent_injuries,
      recent_injuries: formData.recent_injuries,
      has_other_conditions: formData.has_other_conditions,
      other_conditions: formData.other_conditions,
    });

    setHasMedications(formData.has_medications);
    setHasAllergies(formData.has_allergies);
    setIsPregnant(formData.is_pregnant);
    setHasMedicalSupervision(formData.has_medical_supervision);
    setHasBrokenSkin(formData.has_broken_skin);
    setHasJointReplacement(formData.has_joint_replacement);
    setHasRecentInjuries(formData.has_recent_injuries);
    setHasOtherConditions(formData.has_other_conditions);
  }

  // Signature canvas handlers
  function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function getSignatureData(): string | null {
    if (!hasSignature) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  }

  async function handleSubmit(values: any) {
    if (!hasSignature) {
      message.error('Please provide your signature');
      return;
    }

    setSubmitting(true);

    try {
      const formData: IntakeFormData = {
        booking_id: bookingId!,
        has_medications: values.has_medications || false,
        medications: values.has_medications ? values.medications : null,
        has_allergies: values.has_allergies || false,
        allergies: values.has_allergies ? values.allergies : null,
        is_pregnant: values.is_pregnant || false,
        pregnancy_months: values.is_pregnant ? values.pregnancy_months : null,
        pregnancy_due_date: values.is_pregnant && values.pregnancy_due_date ? values.pregnancy_due_date.format('YYYY-MM-DD') : null,
        has_medical_supervision: values.has_medical_supervision || false,
        medical_supervision_details: values.has_medical_supervision ? values.medical_supervision_details : null,
        medical_conditions: values.medical_conditions || [],
        has_broken_skin: values.has_broken_skin || false,
        broken_skin_location: values.has_broken_skin ? values.broken_skin_location : null,
        has_joint_replacement: values.has_joint_replacement || false,
        joint_replacement_details: values.has_joint_replacement ? values.joint_replacement_details : null,
        has_recent_injuries: values.has_recent_injuries || false,
        recent_injuries: values.has_recent_injuries ? values.recent_injuries : null,
        has_other_conditions: values.has_other_conditions || false,
        other_conditions: values.has_other_conditions ? values.other_conditions : null,
        signature_data: getSignatureData(),
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('client_intake_forms')
        .upsert(formData, { onConflict: 'booking_id' });

      if (error) throw error;

      message.success('Health intake form submitted successfully!');
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Error submitting form:', err);
      message.error('There was an error submitting your form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f8f9' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '48px 24px', maxWidth: 600, margin: '0 auto', background: '#f0f8f9', minHeight: '100vh' }}>
        <Alert message="Error" description={error} type="error" showIcon />
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ padding: '48px 24px', maxWidth: 600, margin: '0 auto', background: '#f0f8f9', minHeight: '100vh' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#007e8c', marginBottom: 16 }} />
            <Title level={2} style={{ color: '#007e8c', marginBottom: 16 }}>Thank You!</Title>
            <Paragraph style={{ fontSize: 16 }}>
              Your health intake form has been submitted successfully.
            </Paragraph>
            <Paragraph style={{ fontSize: 16 }}>
              Your therapist will review this information before your appointment.
            </Paragraph>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '48px 24px', maxWidth: 800, margin: '0 auto', background: '#f0f8f9', minHeight: '100vh' }}>
      <Card>
        <Title level={2} style={{ color: '#007e8c', marginBottom: 8 }}>Health Intake Form</Title>
        {bookingInfo && (
          <Text type="secondary">Booking ID: {bookingInfo.booking_id || bookingInfo.id}</Text>
        )}

        <Divider />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark="optional"
        >
          <Title level={4} style={{ marginTop: 24 }}>Medications & Allergies</Title>

          <Form.Item
            name="has_medications"
            label="Are you currently taking any medications?"
            rules={[{ required: true, message: 'Please answer this question' }]}
          >
            <Radio.Group onChange={(e) => setHasMedications(e.target.value)}>
              <Radio value={true}>Yes</Radio>
              <Radio value={false}>No</Radio>
            </Radio.Group>
          </Form.Item>

          {hasMedications && (
            <Form.Item
              name="medications"
              label="Please list all medications"
              rules={[{ required: true, message: 'Please list your medications' }]}
            >
              <TextArea rows={2} placeholder="List all medications" />
            </Form.Item>
          )}

          <Form.Item
            name="has_allergies"
            label="Do you have any allergies (medications, oils, lotions, etc.)?"
            rules={[{ required: true, message: 'Please answer this question' }]}
          >
            <Radio.Group onChange={(e) => setHasAllergies(e.target.value)}>
              <Radio value={true}>Yes</Radio>
              <Radio value={false}>No</Radio>
            </Radio.Group>
          </Form.Item>

          {hasAllergies && (
            <Form.Item
              name="allergies"
              label="Please list all allergies"
              rules={[{ required: true, message: 'Please list your allergies' }]}
            >
              <TextArea rows={2} placeholder="List all allergies" />
            </Form.Item>
          )}

          <Title level={4} style={{ marginTop: 32 }}>Health Status</Title>

          <Form.Item
            name="is_pregnant"
            label="Are you pregnant?"
            rules={[{ required: true, message: 'Please answer this question' }]}
          >
            <Radio.Group onChange={(e) => setIsPregnant(e.target.value)}>
              <Radio value={true}>Yes</Radio>
              <Radio value={false}>No</Radio>
            </Radio.Group>
          </Form.Item>

          {isPregnant && (
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              <Form.Item
                name="pregnancy_months"
                label="How many months pregnant?"
                rules={[{ required: true, message: 'Please specify' }]}
              >
                <InputNumber min={1} max={9} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="pregnancy_due_date"
                label="Due date (optional)"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Space>
          )}

          <Form.Item
            name="has_medical_supervision"
            label="Are you under medical supervision for any condition?"
            rules={[{ required: true, message: 'Please answer this question' }]}
          >
            <Radio.Group onChange={(e) => setHasMedicalSupervision(e.target.value)}>
              <Radio value={true}>Yes</Radio>
              <Radio value={false}>No</Radio>
            </Radio.Group>
          </Form.Item>

          {hasMedicalSupervision && (
            <Form.Item
              name="medical_supervision_details"
              label="Please describe"
              rules={[{ required: true, message: 'Please provide details' }]}
            >
              <TextArea rows={2} />
            </Form.Item>
          )}

          <Title level={4} style={{ marginTop: 32 }}>Medical Conditions</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Please check all that apply:
          </Text>

          <Form.Item name="medical_conditions">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 8]}>
                {medicalConditionsList.map((condition) => (
                  <Col span={8} key={condition}>
                    <Checkbox value={condition}>{condition}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Title level={4} style={{ marginTop: 32 }}>Additional Questions</Title>

          <Form.Item
            name="has_broken_skin"
            label="Do you have any broken skin, wounds, or rashes?"
            rules={[{ required: true, message: 'Please answer this question' }]}
          >
            <Radio.Group onChange={(e) => setHasBrokenSkin(e.target.value)}>
              <Radio value={true}>Yes</Radio>
              <Radio value={false}>No</Radio>
            </Radio.Group>
          </Form.Item>

          {hasBrokenSkin && (
            <Form.Item
              name="broken_skin_location"
              label="Please specify location"
              rules={[{ required: true, message: 'Please specify location' }]}
            >
              <TextArea rows={2} />
            </Form.Item>
          )}

          <Form.Item
            name="has_joint_replacement"
            label="Have you had any joint replacements?"
            rules={[{ required: true, message: 'Please answer this question' }]}
          >
            <Radio.Group onChange={(e) => setHasJointReplacement(e.target.value)}>
              <Radio value={true}>Yes</Radio>
              <Radio value={false}>No</Radio>
            </Radio.Group>
          </Form.Item>

          {hasJointReplacement && (
            <Form.Item
              name="joint_replacement_details"
              label="Please specify which joint(s)"
              rules={[{ required: true, message: 'Please specify' }]}
            >
              <TextArea rows={2} />
            </Form.Item>
          )}

          <Form.Item
            name="has_recent_injuries"
            label="Have you had any recent injuries or accidents?"
            rules={[{ required: true, message: 'Please answer this question' }]}
          >
            <Radio.Group onChange={(e) => setHasRecentInjuries(e.target.value)}>
              <Radio value={true}>Yes</Radio>
              <Radio value={false}>No</Radio>
            </Radio.Group>
          </Form.Item>

          {hasRecentInjuries && (
            <Form.Item
              name="recent_injuries"
              label="Please describe"
              rules={[{ required: true, message: 'Please describe your injuries' }]}
            >
              <TextArea rows={2} placeholder="Describe any injuries or accidents" />
            </Form.Item>
          )}

          <Form.Item
            name="has_other_conditions"
            label="Any other conditions or information your therapist should know?"
            rules={[{ required: true, message: 'Please answer this question' }]}
          >
            <Radio.Group onChange={(e) => setHasOtherConditions(e.target.value)}>
              <Radio value={true}>Yes</Radio>
              <Radio value={false}>No</Radio>
            </Radio.Group>
          </Form.Item>

          {hasOtherConditions && (
            <Form.Item
              name="other_conditions"
              label="Please describe"
              rules={[{ required: true, message: 'Please provide details' }]}
            >
              <TextArea rows={2} placeholder="Any other relevant information" />
            </Form.Item>
          )}

          <Title level={4} style={{ marginTop: 32 }}>Signature</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Please sign below to confirm the information provided is accurate:
          </Text>

          <div style={{ marginBottom: 16 }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
              onTouchMove={(e) => { e.preventDefault(); draw(e); }}
              onTouchEnd={stopDrawing}
              style={{
                border: '1px solid #d4e9ec',
                borderRadius: 8,
                cursor: 'crosshair',
                width: '100%',
                touchAction: 'none'
              }}
            />
          </div>

          <Button onClick={clearSignature} style={{ marginBottom: 24 }}>
            Clear Signature
          </Button>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={submitting}
            >
              Submit Health Intake Form
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
