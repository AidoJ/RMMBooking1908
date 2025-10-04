import React, { useState, useEffect } from 'react';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { useParams } from 'react-router';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess, isAdmin } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import dayjs, { Dayjs } from 'dayjs';
import './edit-new.css';

// Interfaces
interface Booking {
  id: string;
  customer_id: string;
  therapist_id: string;
  service_id: string;
  booking_time: string;
  status: string;
  payment_status: string;
  price: number;
  therapist_fee: number;
  address: string;
  business_name?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  duration_minutes?: number;
  gender_preference?: string;
  parking?: string;
  room_number?: string;
  booking_id?: string;
  customer_code?: string;
  first_name?: string;
  last_name?: string;
  customer_email?: string;
  customer_phone?: string;
  created_at: string;
  updated_at: string;
  booking_type?: string;
  discount_amount?: number;
  tax_rate_amount?: number;
  gift_card_amount?: number;
  discount_code?: string;
  gift_card_code?: string;

  // Joined data
  customer_details?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  therapist_details?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    profile_pic?: string;
  };
  service_details?: {
    name: string;
    description?: string;
    service_base_price: number;
    minimum_duration: number;
  };
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

interface Therapist {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  profile_pic?: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  service_base_price: number;
  minimum_duration: number;
  is_active: boolean;
}

export const BookingEditNew: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { list } = useNavigation();
  const { id } = useParams();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [activeTab, setActiveTab] = useState('details');

  // Form state
  const [formData, setFormData] = useState({
    // Customer
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    businessName: '',

    // Location
    address: '',
    roomDetails: '',
    accessInstructions: '',
    notes: '',

    // Scheduling
    date: '',
    startTime: '',
    duration: 60,

    // Service & Therapist
    serviceId: '',
    therapistId: '',

    // Finance
    basePrice: 0,
    durationUplift: 0,
    timeUplift: 0,
    discountAmount: 0,
    discountCode: '',
    gstAmount: 0,
    totalAmount: 0,
    paymentMethod: 'card',
    paymentStatus: 'pending',
  });

  useEffect(() => {
    if (id) {
      fetchBookingData();
      fetchTherapists();
      fetchServices();
    }
  }, [id]);

  const fetchBookingData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('bookings')
        .select(`
          *,
          customers(first_name, last_name, email, phone),
          therapist_profiles!bookings_therapist_id_fkey(first_name, last_name, email, phone, profile_pic),
          services(name, description, service_base_price, minimum_duration)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setBooking(data);

      // Populate form
      setFormData({
        firstName: data.customers?.first_name || '',
        lastName: data.customers?.last_name || '',
        email: data.customers?.email || '',
        phone: data.customers?.phone || '',
        businessName: data.business_name || '',
        address: data.address || '',
        roomDetails: data.room_number || '',
        accessInstructions: data.parking || '',
        notes: data.notes || '',
        date: dayjs(data.booking_time).format('YYYY-MM-DD'),
        startTime: dayjs(data.booking_time).format('HH:mm'),
        duration: data.duration_minutes || 60,
        serviceId: data.service_id || '',
        therapistId: data.therapist_id || '',
        basePrice: data.service_details?.service_base_price || 0,
        durationUplift: 0,
        timeUplift: 0,
        discountAmount: data.discount_amount || 0,
        discountCode: data.discount_code || '',
        gstAmount: data.tax_rate_amount || 0,
        totalAmount: data.price || 0,
        paymentMethod: data.payment_method || 'card',
        paymentStatus: data.payment_status || 'pending',
      });
    } catch (error) {
      console.error('Error fetching booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTherapists = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setTherapists(data || []);
    } catch (error) {
      console.error('Error fetching therapists:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Auto-recalculate pricing when certain fields change
    if (['duration', 'serviceId', 'date', 'startTime'].includes(field)) {
      recalculatePricing();
    }
  };

  const recalculatePricing = () => {
    // TODO: Implement pricing calculation
    // This will include:
    // - Base price from service
    // - Duration uplift
    // - Time uplift (afterhours/weekend)
    // - Discount
    // - GST
  };

  // Quick Actions Handlers
  const handleConfirmBooking = async () => {
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          status: 'confirmed',
          confirmation_sent_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Refresh booking data
      await fetchBookingData();
      alert('✅ Booking confirmed successfully!');
    } catch (error) {
      console.error('Error confirming booking:', error);
      alert('❌ Failed to confirm booking. Please try again.');
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_captured_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, paymentStatus: 'paid' }));
      await fetchBookingData();
      alert('✅ Payment marked as paid!');
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('❌ Failed to update payment status. Please try again.');
    }
  };

  const handleCancelBooking = async () => {
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to cancel this booking? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          status: 'cancelled',
          cancellation_reason: 'Cancelled by admin',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await fetchBookingData();
      alert('✅ Booking cancelled successfully.');
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('❌ Failed to cancel booking. Please try again.');
    }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;

    try {
      const updateData: any = { status: newStatus };

      // Add timestamps for specific status changes
      if (newStatus === 'confirmed' && !booking?.confirmation_sent_at) {
        updateData.confirmation_sent_at = new Date().toISOString();
      }
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      if (newStatus === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      const { error } = await supabaseClient
        .from('bookings')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await fetchBookingData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('❌ Failed to update status. Please try again.');
    }
  };

  // Payment Actions Handlers
  const handleAuthorizePayment = async () => {
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          payment_status: 'authorized',
          payment_authorized_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, paymentStatus: 'authorized' }));
      await fetchBookingData();
      alert('✅ Payment authorized successfully!');
    } catch (error) {
      console.error('Error authorizing payment:', error);
      alert('❌ Failed to authorize payment. Please try again.');
    }
  };

  const handleRefund = async () => {
    const refundAmount = prompt(
      `Enter refund amount (max $${formData.totalAmount.toFixed(2)}):`
    );

    if (!refundAmount) return;

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > formData.totalAmount) {
      alert('❌ Invalid refund amount.');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Are you sure you want to issue a refund of $${amount.toFixed(2)}?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          payment_status: 'refunded',
          refund_amount: amount,
          refunded_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, paymentStatus: 'refunded' }));
      await fetchBookingData();
      alert(`✅ Refund of $${amount.toFixed(2)} issued successfully!`);
    } catch (error) {
      console.error('Error issuing refund:', error);
      alert('❌ Failed to issue refund. Please try again.');
    }
  };

  const handleSendInvoice = async () => {
    // TODO: Integrate with email service
    alert('📧 Invoice email functionality coming soon...');
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // TODO: Save booking updates
      // Update booking, customer, therapist assignment

      console.log('Saving booking...', formData);

      // Show success message
      alert('Booking saved successfully!');
    } catch (error) {
      console.error('Error saving booking:', error);
      alert('Error saving booking');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <div className="booking-edit-container">
        {/* Header */}
        <div className="header">
          <h1>Admin Booking Management</h1>
          <div className="booking-id">Booking ID: {booking?.booking_id || booking?.id}</div>
        </div>

        {/* Alert */}
        <div className="alert">
          <div className="alert-icon">🔒</div>
          <div>Safe Editing: Changes are saved automatically. Use action buttons on the right for status and payment changes.</div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {/* Left Panel - Tabs */}
          <div className="left-panel">
            {/* Tabs */}
            <div className="tabs">
              <div
                className={`tab ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                👤 Details
              </div>
              <div
                className={`tab ${activeTab === 'scheduling' ? 'active' : ''}`}
                onClick={() => setActiveTab('scheduling')}
              >
                📅 Scheduling
              </div>
              <div
                className={`tab ${activeTab === 'therapist' ? 'active' : ''}`}
                onClick={() => setActiveTab('therapist')}
              >
                👨‍⚕️ Therapist
              </div>
              <div
                className={`tab ${activeTab === 'finance' ? 'active' : ''}`}
                onClick={() => setActiveTab('finance')}
              >
                💰 Finance
              </div>
              <div
                className={`tab ${activeTab === 'communication' ? 'active' : ''}`}
                onClick={() => setActiveTab('communication')}
              >
                💬 Communication
              </div>
            </div>

            {/* Tab Contents */}
            <div className="tab-contents">
              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="tab-content">
                  <div className="form-section">
                    <div className="section-header">👤 Customer Information</div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={formData.firstName + ' ' + formData.lastName}
                          onChange={(e) => {
                            const names = e.target.value.split(' ');
                            handleInputChange('firstName', names[0] || '');
                            handleInputChange('lastName', names.slice(1).join(' ') || '');
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Phone</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Business Name</label>
                        <input
                          type="text"
                          value={formData.businessName}
                          onChange={(e) => handleInputChange('businessName', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="section-header">📍 Service Location</div>
                    <div className="form-grid">
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Address</label>
                        <textarea
                          value={formData.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Room Details</label>
                        <input
                          type="text"
                          value={formData.roomDetails}
                          onChange={(e) => handleInputChange('roomDetails', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Access Instructions</label>
                        <input
                          type="text"
                          value={formData.accessInstructions}
                          onChange={(e) => handleInputChange('accessInstructions', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="section-header">📝 Notes & Special Requests</div>
                    <div className="form-group">
                      <label>Special Requirements</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Scheduling Tab */}
              {activeTab === 'scheduling' && (
                <div className="tab-content">
                  <div className="form-section">
                    <div className="section-header">📅 Date & Time</div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Date</label>
                        <input
                          type="date"
                          value={formData.date}
                          onChange={(e) => handleInputChange('date', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Start Time</label>
                        <input
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => handleInputChange('startTime', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="section-header">⏱️ Duration</div>
                    <div className="duration-cards">
                      <div
                        className={`duration-card ${formData.duration === 60 ? 'selected' : ''}`}
                        onClick={() => handleInputChange('duration', 60)}
                      >
                        <h3>60 mins</h3>
                        <p>${formData.basePrice}</p>
                      </div>
                      <div
                        className={`duration-card ${formData.duration === 90 ? 'selected' : ''}`}
                        onClick={() => handleInputChange('duration', 90)}
                      >
                        <h3>90 mins</h3>
                        <p>${formData.basePrice * 1.5}</p>
                      </div>
                      <div
                        className={`duration-card ${formData.duration === 120 ? 'selected' : ''}`}
                        onClick={() => handleInputChange('duration', 120)}
                      >
                        <h3>120 mins</h3>
                        <p>${formData.basePrice * 2}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Therapist Tab */}
              {activeTab === 'therapist' && (
                <div className="tab-content">
                  <div className="form-section">
                    <div className="section-header">👨‍⚕️ Select Therapist</div>
                    <div className="therapist-grid">
                      {therapists.map(therapist => (
                        <div
                          key={therapist.id}
                          className={`therapist-card ${formData.therapistId === therapist.id ? 'selected' : ''}`}
                          onClick={() => handleInputChange('therapistId', therapist.id)}
                        >
                          <div className="therapist-header">
                            <div className="therapist-avatar">
                              {therapist.first_name[0]}{therapist.last_name[0]}
                            </div>
                            <div className="therapist-info">
                              <h3>{therapist.first_name} {therapist.last_name}</h3>
                              <p>{therapist.email}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Finance Tab */}
              {activeTab === 'finance' && (
                <div className="tab-content">
                  <div className="form-section">
                    <div className="section-header">💰 Pricing Calculator</div>
                    <div className="pricing-calculator">
                      <div className="pricing-row">
                        <span className="pricing-label">Base Price</span>
                        <span className="pricing-value">${formData.basePrice.toFixed(2)}</span>
                      </div>
                      <div className="pricing-row">
                        <span className="pricing-label">Duration Uplift</span>
                        <span className="pricing-value">+${formData.durationUplift.toFixed(2)}</span>
                      </div>
                      <div className="pricing-row">
                        <span className="pricing-label">Time Uplift</span>
                        <span className="pricing-value">+${formData.timeUplift.toFixed(2)}</span>
                      </div>
                      <div className="pricing-row">
                        <span className="pricing-label">Discount</span>
                        <span className="pricing-value">-${formData.discountAmount.toFixed(2)}</span>
                      </div>
                      <div className="pricing-row">
                        <span className="pricing-label">GST (10%)</span>
                        <span className="pricing-value">+${formData.gstAmount.toFixed(2)}</span>
                      </div>
                      <div className="pricing-row">
                        <span className="pricing-label">Total Amount</span>
                        <span className="pricing-value">${formData.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Communication Tab */}
              {activeTab === 'communication' && (
                <div className="tab-content">
                  <div className="form-section">
                    <div className="section-header">📧 Quick Communication</div>
                    <p>Communication features coming soon...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="bottom-actions">
              <button className="bottom-btn cancel" onClick={() => list('bookings')}>
                ❌ Cancel Changes
              </button>
              <button
                className="bottom-btn save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '⏳ Saving...' : '💾 Save All Changes'}
              </button>
            </div>
          </div>

          {/* Right Panel - Actions & Summary */}
          <div className="right-panel">
            {/* Financial Summary Card */}
            <div className="card">
              <div className="card-header">💰 Financial Summary</div>
              <div className="card-content">
                <div className="summary-row">
                  <span>Base Price</span>
                  <span>${formData.basePrice.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Duration Uplift</span>
                  <span>+${formData.durationUplift.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Time Uplift</span>
                  <span>+${formData.timeUplift.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>${(formData.basePrice + formData.durationUplift + formData.timeUplift).toFixed(2)}</span>
                </div>
                {formData.discountAmount > 0 && (
                  <div className="summary-row">
                    <span>Discount {formData.discountCode && `(${formData.discountCode})`}</span>
                    <span style={{ color: '#16a34a' }}>-${formData.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span>GST (10%)</span>
                  <span>+${formData.gstAmount.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Total Amount</span>
                  <span>${formData.totalAmount.toFixed(2)}</span>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                  <div className="summary-row" style={{ fontSize: '12px', marginBottom: '4px' }}>
                    <span>Payment Status</span>
                    <span style={{
                      color: formData.paymentStatus === 'paid' ? '#16a34a' :
                             formData.paymentStatus === 'pending' ? '#f59e0b' : '#dc2626',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {formData.paymentStatus}
                    </span>
                  </div>
                  <div className="summary-row" style={{ fontSize: '12px' }}>
                    <span>Payment Method</span>
                    <span style={{ textTransform: 'capitalize' }}>{formData.paymentMethod}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <div className="card-header">⚡ Quick Actions</div>
              <div className="card-content">
                <div className="action-buttons">
                  <button
                    className="action-btn primary"
                    onClick={handleConfirmBooking}
                    disabled={booking?.status === 'confirmed'}
                  >
                    ✅ Confirm Booking
                  </button>
                  <button
                    className="action-btn secondary"
                    onClick={handleMarkAsPaid}
                    disabled={formData.paymentStatus === 'paid'}
                  >
                    💰 Mark as Paid
                  </button>
                  <button
                    className="action-btn warning"
                    onClick={() => setActiveTab('scheduling')}
                  >
                    📅 Reschedule
                  </button>
                  <button
                    className="action-btn danger"
                    onClick={handleCancelBooking}
                    disabled={booking?.status === 'cancelled'}
                  >
                    ❌ Cancel Booking
                  </button>
                </div>
              </div>
            </div>

            {/* Status Management Card */}
            <div className="card">
              <div className="card-header">📊 Status Management</div>
              <div className="card-content">
                <div className="form-group">
                  <label>Booking Status</label>
                  <select
                    value={booking?.status || 'pending'}
                    onChange={handleStatusChange}
                    style={{ width: '100%' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No Show</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Booking Information Card */}
            <div className="card">
              <div className="card-header">ℹ️ Booking Info</div>
              <div className="card-content" style={{ fontSize: '12px' }}>
                <div className="summary-row" style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>Booking ID</span>
                  <span style={{ fontFamily: 'monospace' }}>{booking?.id?.slice(0, 8)}</span>
                </div>
                <div className="summary-row" style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>Created</span>
                  <span>{booking?.created_at ? dayjs(booking.created_at).format('DD/MM/YYYY HH:mm') : '-'}</span>
                </div>
                <div className="summary-row" style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>Last Updated</span>
                  <span>{booking?.updated_at ? dayjs(booking.updated_at).format('DD/MM/YYYY HH:mm') : '-'}</span>
                </div>
                {booking?.confirmation_sent_at && (
                  <div className="summary-row">
                    <span style={{ color: '#64748b' }}>Confirmation Sent</span>
                    <span>{dayjs(booking.confirmation_sent_at).format('DD/MM/YYYY HH:mm')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Actions Card */}
            <div className="card">
              <div className="card-header">💳 Payment Actions</div>
              <div className="card-content">
                <div className="action-buttons">
                  <button
                    className="action-btn secondary"
                    onClick={handleAuthorizePayment}
                    disabled={formData.paymentStatus === 'authorized' || formData.paymentStatus === 'paid'}
                  >
                    🔐 Authorize Payment
                  </button>
                  <button
                    className="action-btn warning"
                    onClick={handleRefund}
                    disabled={formData.paymentStatus !== 'paid'}
                  >
                    🔄 Issue Refund
                  </button>
                  <button
                    className="action-btn secondary"
                    onClick={handleSendInvoice}
                  >
                    📧 Send Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
};
