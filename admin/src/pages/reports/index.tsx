import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Space,
  Typography,
  Table,
  Tag,
  Spin,
  Button,
  Tabs,
  Progress,
  Alert,
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  ShoppingOutlined,
  RiseOutlined,
  FallOutlined,
  DownloadOutlined,
  ReloadOutlined,
  TeamOutlined,
  GiftOutlined,
  PercentageOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// ========== INTERFACES ==========

interface RevenueData {
  totalRevenue: number;
  totalBookings: number;
  completedBookings: number;
  averageBookingValue: number;
  totalTherapistFees: number;
  netProfit: number;
  revenueChange: number;
}

interface TherapistPerformance {
  id: string;
  name: string;
  completedJobs: number;
  totalHours: number;
  totalFees: number;
  averageHourlyRate: number;
}

interface TherapistPayment {
  therapist_name: string;
  week: string;
  calculated_fees: number;
  claimed_fees: number;
  variance: number;
  status: string;
}

interface ServicePerformance {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
  therapistFees: number;
  netProfit: number;
  averagePrice: number;
}

interface BookingByDay {
  dayOfWeek: string;
  count: number;
  revenue: number;
}

interface BookingByHour {
  hour: number;
  count: number;
}

interface CustomerInsight {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageLifetimeValue: number;
  retentionRate: number;
  topCustomers: Array<{
    name: string;
    email: string;
    bookings: number;
    totalSpent: number;
  }>;
}

interface DiscountData {
  code: string;
  usage_count: number;
  total_discount: number;
  revenue_generated: number;
  roi: number;
}

interface GiftCardData {
  total_sold: number;
  total_sold_amount: number;
  total_redeemed: number;
  total_redeemed_amount: number;
  unredeemed_balance: number;
}

interface QuoteData {
  total_quotes: number;
  accepted_quotes: number;
  declined_quotes: number;
  acceptance_rate: number;
  average_quote_value: number;
  total_quote_revenue: number;
}

interface QuoteMetrics {
  // Status counts
  total_quotes: number;
  draft_quotes: number;
  sent_quotes: number;
  accepted_quotes: number;
  declined_quotes: number;
  pending_quotes: number;

  // Response time metrics (in hours)
  avg_draft_to_sent: number;
  avg_sent_to_response: number;
  avg_response_to_completed: number;
  avg_total_cycle_time: number;

  // Value metrics
  total_quote_value: number;
  accepted_quote_value: number;
  average_quote_value: number;
  acceptance_rate: number;

  // Recent quotes for table
  recentQuotes: Array<{
    id: string;
    quote_number: string;
    customer_name: string;
    total_price: number;
    status: string;
    created_at: string;
    sent_at: string | null;
    accepted_at: string | null;
    completed_at: string | null;
    days_in_current_status: number;
  }>;
}

// ========== MAIN COMPONENT ==========

export const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Filter states
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');

  // Data states
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [therapistPerformance, setTherapistPerformance] = useState<TherapistPerformance[]>([]);
  const [therapistPayments, setTherapistPayments] = useState<TherapistPayment[]>([]);
  const [servicePerformance, setServicePerformance] = useState<ServicePerformance[]>([]);
  const [bookingByDay, setBookingByDay] = useState<BookingByDay[]>([]);
  const [bookingByHour, setBookingByHour] = useState<BookingByHour[]>([]);
  const [customerInsights, setCustomerInsights] = useState<CustomerInsight | null>(null);
  const [discountData, setDiscountData] = useState<DiscountData[]>([]);
  const [giftCardData, setGiftCardData] = useState<GiftCardData | null>(null);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [quoteMetrics, setQuoteMetrics] = useState<QuoteMetrics | null>(null);

  // Filter options
  const [therapists, setTherapists] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadAllData();
  }, [dateRange, selectedTherapist, selectedService]);

  const loadFilterOptions = async () => {
    try {
      const { data: therapistsData } = await supabaseClient
        .from('therapist_profiles')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .order('first_name');

      const { data: servicesData } = await supabaseClient
        .from('services')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      setTherapists(therapistsData || []);
      setServices(servicesData || []);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRevenueDashboard(),
        loadTherapistPerformance(),
        loadTherapistPayments(),
        loadServicePerformance(),
        loadBookingAnalytics(),
        loadCustomerInsights(),
        loadMarketingData(),
        loadQuoteMetrics(),
      ]);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========== DATA LOADING FUNCTIONS ==========

  const loadRevenueDashboard = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      let query = supabaseClient
        .from('bookings')
        .select('id, price, therapist_fee, status, booking_time')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate + ' 23:59:59');

      if (selectedTherapist !== 'all') query = query.eq('therapist_id', selectedTherapist);
      if (selectedService !== 'all') query = query.eq('service_id', selectedService);

      const { data: bookings } = await query;
      const completed = bookings?.filter(b => b.status === 'completed') || [];

      const totalRevenue = completed.reduce((sum, b) => sum + parseFloat(b.price?.toString() || '0'), 0);
      const totalTherapistFees = completed.reduce((sum, b) => sum + parseFloat(b.therapist_fee?.toString() || '0'), 0);

      // Previous period comparison
      const daysDiff = dateRange[1].diff(dateRange[0], 'day');
      const prevStart = dateRange[0].subtract(daysDiff + 1, 'day');
      const prevEnd = dateRange[0].subtract(1, 'day');

      const { data: prevBookings } = await supabaseClient
        .from('bookings')
        .select('price')
        .eq('status', 'completed')
        .gte('booking_time', prevStart.format('YYYY-MM-DD'))
        .lte('booking_time', prevEnd.format('YYYY-MM-DD') + ' 23:59:59');

      const prevRevenue = prevBookings?.reduce((sum, b) => sum + parseFloat(b.price?.toString() || '0'), 0) || 0;
      const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      setRevenueData({
        totalRevenue,
        totalBookings: bookings?.length || 0,
        completedBookings: completed.length,
        averageBookingValue: completed.length > 0 ? totalRevenue / completed.length : 0,
        totalTherapistFees,
        netProfit: totalRevenue - totalTherapistFees,
        revenueChange,
      });
    } catch (error) {
      console.error('Error loading revenue dashboard:', error);
    }
  };

  const loadTherapistPerformance = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const { data: bookings } = await supabaseClient
        .from('bookings')
        .select(`
          therapist_id,
          duration_minutes,
          therapist_fee,
          therapist_profiles!therapist_id (first_name, last_name)
        `)
        .eq('status', 'completed')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate + ' 23:59:59');

      const therapistMap = new Map<string, TherapistPerformance>();

      bookings?.forEach(b => {
        const therapist = b.therapist_profiles as any;
        if (!therapist) return;

        const id = b.therapist_id;
        const name = `${therapist.first_name} ${therapist.last_name}`;

        if (!therapistMap.has(id)) {
          therapistMap.set(id, { id, name, completedJobs: 0, totalHours: 0, totalFees: 0, averageHourlyRate: 0 });
        }

        const perf = therapistMap.get(id)!;
        perf.completedJobs += 1;
        perf.totalHours += (b.duration_minutes || 0) / 60;
        perf.totalFees += parseFloat(b.therapist_fee?.toString() || '0');
      });

      therapistMap.forEach(perf => {
        if (perf.totalHours > 0) perf.averageHourlyRate = perf.totalFees / perf.totalHours;
      });

      setTherapistPerformance(Array.from(therapistMap.values()).sort((a, b) => b.totalFees - a.totalFees));
    } catch (error) {
      console.error('Error loading therapist performance:', error);
    }
  };

  const loadTherapistPayments = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const { data: payments } = await supabaseClient
        .from('therapist_payments')
        .select(`
          therapist_id,
          week_start_date,
          week_end_date,
          calculated_fees,
          therapist_invoiced_fees,
          status,
          therapist_profiles!therapist_id (first_name, last_name)
        `)
        .gte('week_start_date', startDate)
        .lte('week_end_date', endDate);

      const paymentsList: TherapistPayment[] = (payments || []).map(p => {
        const therapist = p.therapist_profiles as any;
        const calculated = parseFloat(p.calculated_fees?.toString() || '0');
        const claimed = parseFloat(p.therapist_invoiced_fees?.toString() || '0');

        return {
          therapist_name: therapist ? `${therapist.first_name} ${therapist.last_name}` : 'Unknown',
          week: `${dayjs(p.week_start_date).format('MMM DD')} - ${dayjs(p.week_end_date).format('MMM DD')}`,
          calculated_fees: calculated,
          claimed_fees: claimed,
          variance: claimed - calculated,
          status: p.status || 'draft',
        };
      });

      setTherapistPayments(paymentsList);
    } catch (error) {
      console.error('Error loading therapist payments:', error);
    }
  };

  const loadServicePerformance = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const { data: bookings } = await supabaseClient
        .from('bookings')
        .select(`
          service_id,
          price,
          therapist_fee,
          services!service_id (name)
        `)
        .eq('status', 'completed')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate + ' 23:59:59');

      const serviceMap = new Map<string, ServicePerformance>();

      bookings?.forEach(b => {
        const service = b.services as any;
        if (!service) return;

        const id = b.service_id;
        if (!serviceMap.has(id)) {
          serviceMap.set(id, { id, name: service.name, bookings: 0, revenue: 0, therapistFees: 0, netProfit: 0, averagePrice: 0 });
        }

        const perf = serviceMap.get(id)!;
        perf.bookings += 1;
        perf.revenue += parseFloat(b.price?.toString() || '0');
        perf.therapistFees += parseFloat(b.therapist_fee?.toString() || '0');
      });

      serviceMap.forEach(perf => {
        perf.netProfit = perf.revenue - perf.therapistFees;
        perf.averagePrice = perf.bookings > 0 ? perf.revenue / perf.bookings : 0;
      });

      setServicePerformance(Array.from(serviceMap.values()).sort((a, b) => b.revenue - a.revenue));
    } catch (error) {
      console.error('Error loading service performance:', error);
    }
  };

  const loadBookingAnalytics = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const { data: bookings } = await supabaseClient
        .from('bookings')
        .select('booking_time, price')
        .eq('status', 'completed')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate + ' 23:59:59');

      // By day of week
      const dayMap = new Map<number, { count: number; revenue: number }>();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // By hour of day
      const hourMap = new Map<number, number>();
      for (let i = 0; i < 24; i++) hourMap.set(i, 0);

      bookings?.forEach(b => {
        const dt = dayjs(b.booking_time);
        const dayOfWeek = dt.day();
        const hour = dt.hour();

        if (!dayMap.has(dayOfWeek)) dayMap.set(dayOfWeek, { count: 0, revenue: 0 });
        const dayData = dayMap.get(dayOfWeek)!;
        dayData.count += 1;
        dayData.revenue += parseFloat(b.price?.toString() || '0');

        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      });

      const byDay: BookingByDay[] = days.map((dayName, idx) => {
        const data = dayMap.get(idx) || { count: 0, revenue: 0 };
        return { dayOfWeek: dayName, count: data.count, revenue: data.revenue };
      });

      const byHour: BookingByHour[] = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count }));

      setBookingByDay(byDay);
      setBookingByHour(byHour);
    } catch (error) {
      console.error('Error loading booking analytics:', error);
    }
  };

  const loadCustomerInsights = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      // Get all customers with bookings
      const { data: bookings } = await supabaseClient
        .from('bookings')
        .select(`
          customer_id,
          price,
          created_at,
          customers!customer_id (id, first_name, last_name, email, created_at)
        `)
        .eq('status', 'completed')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate + ' 23:59:59');

      const customerMap = new Map<string, { name: string; email: string; bookings: number; totalSpent: number; firstBooking: string }>();

      bookings?.forEach(b => {
        const customer = b.customers as any;
        if (!customer) return;

        const id = b.customer_id;
        if (!customerMap.has(id)) {
          customerMap.set(id, {
            name: `${customer.first_name} ${customer.last_name}`,
            email: customer.email,
            bookings: 0,
            totalSpent: 0,
            firstBooking: b.created_at,
          });
        }

        const cust = customerMap.get(id)!;
        cust.bookings += 1;
        cust.totalSpent += parseFloat(b.price?.toString() || '0');
      });

      const totalCustomers = customerMap.size;
      const newCustomers = Array.from(customerMap.values()).filter(c => dayjs(c.firstBooking).isAfter(dateRange[0])).length;
      const returningCustomers = totalCustomers - newCustomers;
      const averageLifetimeValue = totalCustomers > 0 ? Array.from(customerMap.values()).reduce((sum, c) => sum + c.totalSpent, 0) / totalCustomers : 0;
      const retentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

      const topCustomers = Array.from(customerMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      setCustomerInsights({
        totalCustomers,
        newCustomers,
        returningCustomers,
        averageLifetimeValue,
        retentionRate,
        topCustomers,
      });
    } catch (error) {
      console.error('Error loading customer insights:', error);
    }
  };

  const loadMarketingData = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      // Discount codes
      const { data: discountUsage } = await supabaseClient
        .from('discount_code_usage')
        .select(`
          discount_code_id,
          discount_applied,
          booking_id,
          discount_codes!discount_code_id (code)
        `)
        .gte('used_at', startDate)
        .lte('used_at', endDate + ' 23:59:59');

      const discountMap = new Map<string, DiscountData>();

      discountUsage?.forEach(usage => {
        const dc = usage.discount_codes as any;
        if (!dc) return;

        const code = dc.code;
        if (!discountMap.has(code)) {
          discountMap.set(code, { code, usage_count: 0, total_discount: 0, revenue_generated: 0, roi: 0 });
        }

        const data = discountMap.get(code)!;
        data.usage_count += 1;
        data.total_discount += parseFloat(usage.discount_applied?.toString() || '0');
      });

      // Get revenue for bookings with discounts
      for (const [code, data] of discountMap.entries()) {
        const { data: bookings } = await supabaseClient
          .from('bookings')
          .select('price')
          .eq('discount_code', code)
          .eq('status', 'completed');

        data.revenue_generated = bookings?.reduce((sum, b) => sum + parseFloat(b.price?.toString() || '0'), 0) || 0;
        data.roi = data.total_discount > 0 ? (data.revenue_generated / data.total_discount) * 100 : 0;
      }

      setDiscountData(Array.from(discountMap.values()));

      // Gift cards
      const { data: giftCards } = await supabaseClient
        .from('gift_cards')
        .select('initial_balance, current_balance, payment_status, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate + ' 23:59:59');

      const soldCards = giftCards?.filter(gc => gc.payment_status === 'completed') || [];
      const total_sold = soldCards.length;
      const total_sold_amount = soldCards.reduce((sum, gc) => sum + parseFloat(gc.initial_balance?.toString() || '0'), 0);
      const total_redeemed = soldCards.filter(gc => gc.current_balance < gc.initial_balance).length;
      const total_redeemed_amount = soldCards.reduce((sum, gc) => sum + (parseFloat(gc.initial_balance?.toString() || '0') - parseFloat(gc.current_balance?.toString() || '0')), 0);
      const unredeemed_balance = total_sold_amount - total_redeemed_amount;

      setGiftCardData({
        total_sold,
        total_sold_amount,
        total_redeemed,
        total_redeemed_amount,
        unredeemed_balance,
      });

      // Quotes
      const { data: quotes } = await supabaseClient
        .from('quotes')
        .select('status, total_amount')
        .gte('created_at', startDate)
        .lte('created_at', endDate + ' 23:59:59');

      const total_quotes = quotes?.length || 0;
      const accepted_quotes = quotes?.filter(q => q.status === 'accepted').length || 0;
      const declined_quotes = quotes?.filter(q => q.status === 'declined').length || 0;
      const acceptance_rate = total_quotes > 0 ? (accepted_quotes / total_quotes) * 100 : 0;
      const average_quote_value = accepted_quotes > 0 ? quotes?.filter(q => q.status === 'accepted').reduce((sum, q) => sum + parseFloat(q.total_amount?.toString() || '0'), 0) / accepted_quotes : 0;
      const total_quote_revenue = quotes?.filter(q => q.status === 'accepted').reduce((sum, q) => sum + parseFloat(q.total_amount?.toString() || '0'), 0) || 0;

      setQuoteData({
        total_quotes,
        accepted_quotes,
        declined_quotes,
        acceptance_rate,
        average_quote_value,
        total_quote_revenue,
      });
    } catch (error) {
      console.error('Error loading marketing data:', error);
    }
  };

  const loadQuoteMetrics = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      // Fetch all quotes with timestamps - use * to get all fields like list page does
      const { data: quotes, error: quotesError } = await supabaseClient
        .from('quotes')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate + ' 23:59:59')
        .order('created_at', { ascending: false });

      if (quotesError) {
        console.error('Error fetching quotes:', quotesError);
      }

      console.log('📊 Loaded quotes for reports:', quotes?.length || 0, quotes?.[0]);

      if (!quotes || quotes.length === 0) {
        setQuoteMetrics({
          total_quotes: 0,
          draft_quotes: 0,
          sent_quotes: 0,
          accepted_quotes: 0,
          declined_quotes: 0,
          pending_quotes: 0,
          avg_draft_to_sent: 0,
          avg_sent_to_response: 0,
          avg_response_to_completed: 0,
          avg_total_cycle_time: 0,
          total_quote_value: 0,
          accepted_quote_value: 0,
          average_quote_value: 0,
          acceptance_rate: 0,
          recentQuotes: [],
        });
        return;
      }

      // Status counts
      const total_quotes = quotes.length;
      const draft_quotes = quotes.filter(q => q.status === 'draft' || q.status === 'new').length;
      const sent_quotes = quotes.filter(q => q.status === 'sent' || q.quote_sent_at !== null).length;
      const accepted_quotes = quotes.filter(q => q.status === 'accepted').length;
      const declined_quotes = quotes.filter(q => q.status === 'declined').length;
      const pending_quotes = quotes.filter(q => q.status === 'sent' && !q.quote_accepted_at).length;

      // Calculate response times (in hours)
      const draftToSentTimes: number[] = [];
      const sentToResponseTimes: number[] = [];
      const responseToCompletedTimes: number[] = [];
      const totalCycleTimes: number[] = [];

      quotes.forEach(quote => {
        const createdAt = new Date(quote.created_at);
        const sentAt = quote.quote_sent_at ? new Date(quote.quote_sent_at) : null;
        const responseAt = quote.quote_accepted_at ? new Date(quote.quote_accepted_at) : null;
        const completedAt = null; // No completed_at field yet

        // Draft to Sent
        if (sentAt) {
          const hours = (sentAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          draftToSentTimes.push(hours);
        }

        // Sent to Response
        if (sentAt && responseAt) {
          const hours = (responseAt.getTime() - sentAt.getTime()) / (1000 * 60 * 60);
          sentToResponseTimes.push(hours);
        }

        // Response to Completed
        if (responseAt && completedAt) {
          const hours = (completedAt.getTime() - responseAt.getTime()) / (1000 * 60 * 60);
          responseToCompletedTimes.push(hours);
        }

        // Total cycle time
        if (completedAt) {
          const hours = (completedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          totalCycleTimes.push(hours);
        }
      });

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      const avg_draft_to_sent = avg(draftToSentTimes);
      const avg_sent_to_response = avg(sentToResponseTimes);
      const avg_response_to_completed = avg(responseToCompletedTimes);
      const avg_total_cycle_time = avg(totalCycleTimes);

      // Value metrics - use final_amount if available, fallback to total_amount
      const total_quote_value = quotes.reduce((sum, q) => {
        const amount = parseFloat(q.final_amount?.toString() || q.total_amount?.toString() || '0');
        return sum + amount;
      }, 0);
      const accepted_quote_value = quotes
        .filter(q => q.status === 'accepted')
        .reduce((sum, q) => {
          const amount = parseFloat(q.final_amount?.toString() || q.total_amount?.toString() || '0');
          return sum + amount;
        }, 0);
      const average_quote_value = total_quotes > 0 ? total_quote_value / total_quotes : 0;
      const acceptance_rate = total_quotes > 0 ? (accepted_quotes / total_quotes) * 100 : 0;

      // Prepare recent quotes for table
      const recentQuotes = quotes.slice(0, 10).map(quote => {
        const now = new Date();
        let referenceDate: Date;

        // Determine which date to use for "days in current status"
        if (quote.quote_accepted_at) {
          referenceDate = new Date(quote.quote_accepted_at);
        } else if (quote.quote_sent_at) {
          referenceDate = new Date(quote.quote_sent_at);
        } else {
          referenceDate = new Date(quote.created_at);
        }

        const days_in_current_status = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: quote.id,
          quote_number: quote.quote_number || `Q-${quote.id.slice(0, 8)}`,
          customer_name: quote.customer_name || quote.company_name || 'Unknown',
          total_price: parseFloat(quote.final_amount?.toString() || quote.total_amount?.toString() || '0'),
          status: quote.status || 'new',
          created_at: quote.created_at,
          sent_at: quote.quote_sent_at || null,
          accepted_at: quote.quote_accepted_at || null,
          completed_at: null,
          days_in_current_status,
        };
      });

      setQuoteMetrics({
        total_quotes,
        draft_quotes,
        sent_quotes,
        accepted_quotes,
        declined_quotes,
        pending_quotes,
        avg_draft_to_sent,
        avg_sent_to_response,
        avg_response_to_completed,
        avg_total_cycle_time,
        total_quote_value,
        accepted_quote_value,
        average_quote_value,
        acceptance_rate,
        recentQuotes,
      });
    } catch (error) {
      console.error('Error loading quote metrics:', error);
    }
  };

  // ========== RENDER FUNCTIONS ==========

  const renderFilterBar = () => (
    <Card style={{ marginBottom: 24 }}>
      <Space wrap>
        <RangePicker
          value={dateRange}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
          }}
          format="YYYY-MM-DD"
          presets={[
            { label: 'Today', value: [dayjs(), dayjs()] },
            { label: 'This Week', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
            { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
            { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
            { label: 'Last 3 Months', value: [dayjs().subtract(3, 'month').startOf('month'), dayjs().endOf('month')] },
          ]}
        />
        <Select style={{ width: 200 }} value={selectedTherapist} onChange={setSelectedTherapist}>
          <Option value="all">All Therapists</Option>
          {therapists.map(t => (
            <Option key={t.id} value={t.id}>{t.first_name} {t.last_name}</Option>
          ))}
        </Select>
        <Select style={{ width: 200 }} value={selectedService} onChange={setSelectedService}>
          <Option value="all">All Services</Option>
          {services.map(s => (
            <Option key={s.id} value={s.id}>{s.name}</Option>
          ))}
        </Select>
        <Button icon={<ReloadOutlined />} onClick={loadAllData} loading={loading}>Refresh</Button>
      </Space>
    </Card>
  );

  const renderOverviewTab = () => (
    <>
      <Card title="Revenue Dashboard" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Statistic
              title="Total Revenue"
              value={revenueData?.totalRevenue || 0}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#3f8600' }}
              suffix={
                revenueData && revenueData.revenueChange !== 0 ? (
                  <Tag color={revenueData.revenueChange > 0 ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                    {revenueData.revenueChange > 0 ? <RiseOutlined /> : <FallOutlined />}
                    {Math.abs(revenueData.revenueChange).toFixed(1)}%
                  </Tag>
                ) : undefined
              }
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Statistic
              title="Completed Bookings"
              value={revenueData?.completedBookings || 0}
              prefix={<ShoppingOutlined />}
              suffix={`/ ${revenueData?.totalBookings || 0}`}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Statistic
              title="Average Booking Value"
              value={revenueData?.averageBookingValue || 0}
              precision={2}
              prefix="$"
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Statistic
              title="Therapist Fees"
              value={revenueData?.totalTherapistFees || 0}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Statistic
              title="Net Profit"
              value={revenueData?.netProfit || 0}
              precision={2}
              prefix="$"
              valueStyle={{ color: (revenueData?.netProfit || 0) >= 0 ? '#3f8600' : '#cf1322' }}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Statistic
              title="Profit Margin"
              value={revenueData && revenueData.totalRevenue > 0 ? ((revenueData.netProfit / revenueData.totalRevenue) * 100) : 0}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
        </Row>
      </Card>

      <Alert
        message="Quick Business Snapshot"
        description="This overview provides key metrics for the selected date range. Use the tabs above to dive deeper into specific areas."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
    </>
  );

  const renderFinancialsTab = () => (
    <>
      <Card title="Financial Summary" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Total Revenue"
                value={revenueData?.totalRevenue || 0}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Total Costs (Therapist Fees)"
                value={revenueData?.totalTherapistFees || 0}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Net Profit"
                value={revenueData?.netProfit || 0}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: (revenueData?.netProfit || 0) >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card title="Profit & Loss Statement">
        <Table
          dataSource={[
            { category: 'Revenue', subcategory: 'Customer Payments', amount: revenueData?.totalRevenue || 0, type: 'income' },
            { category: 'Costs', subcategory: 'Therapist Fees', amount: revenueData?.totalTherapistFees || 0, type: 'expense' },
            { category: 'Net', subcategory: 'Profit/Loss', amount: revenueData?.netProfit || 0, type: revenueData && revenueData.netProfit >= 0 ? 'income' : 'expense' },
          ]}
          columns={[
            { title: 'Category', dataIndex: 'category', key: 'category' },
            { title: 'Item', dataIndex: 'subcategory', key: 'subcategory' },
            {
              title: 'Amount',
              dataIndex: 'amount',
              key: 'amount',
              render: (amount: number, record: any) => (
                <Text strong style={{ color: record.type === 'income' ? '#3f8600' : '#cf1322' }}>
                  ${amount.toFixed(2)}
                </Text>
              ),
            },
          ]}
          pagination={false}
          rowKey="subcategory"
        />
      </Card>
    </>
  );

  const renderTeamTab = () => (
    <>
      <Card title="Therapist Performance" style={{ marginBottom: 24 }} extra={<Button icon={<DownloadOutlined />} size="small">Export</Button>}>
        <Table
          dataSource={therapistPerformance}
          columns={[
            { title: 'Therapist', dataIndex: 'name', key: 'name' },
            { title: 'Jobs', dataIndex: 'completedJobs', key: 'jobs', align: 'center' },
            { title: 'Hours', dataIndex: 'totalHours', key: 'hours', render: (h: number) => h.toFixed(1) },
            { title: 'Avg Hourly Rate', dataIndex: 'averageHourlyRate', key: 'avgRate', render: (r: number) => `$${r.toFixed(2)}` },
            { title: 'Total Fees', dataIndex: 'totalFees', key: 'fees', render: (f: number) => <Text strong style={{ color: '#52c41a' }}>${f.toFixed(2)}</Text> },
          ]}
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Card title="Payment Reconciliation">
        <Table
          dataSource={therapistPayments}
          columns={[
            { title: 'Therapist', dataIndex: 'therapist_name', key: 'name' },
            { title: 'Week', dataIndex: 'week', key: 'week' },
            { title: 'System Calculated', dataIndex: 'calculated_fees', key: 'calc', render: (f: number) => `$${f.toFixed(2)}` },
            { title: 'Therapist Claimed', dataIndex: 'claimed_fees', key: 'claimed', render: (f: number) => `$${f.toFixed(2)}` },
            {
              title: 'Variance',
              dataIndex: 'variance',
              key: 'variance',
              render: (v: number) => (
                <Text strong style={{ color: Math.abs(v) > 0.01 ? '#ff4d4f' : '#52c41a' }}>
                  {v > 0 ? '+' : ''}${v.toFixed(2)}
                </Text>
              ),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (s: string) => (
                <Tag color={s === 'paid' ? 'green' : s === 'approved' ? 'blue' : 'orange'}>{s.toUpperCase()}</Tag>
              ),
            },
          ]}
          rowKey={(record, idx) => `${record.therapist_name}-${idx}`}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </>
  );

  const renderServicesTab = () => (
    <>
      <Card title="Service Performance" style={{ marginBottom: 24 }} extra={<Button icon={<DownloadOutlined />} size="small">Export</Button>}>
        <Table
          dataSource={servicePerformance}
          columns={[
            { title: 'Service', dataIndex: 'name', key: 'name' },
            { title: 'Bookings', dataIndex: 'bookings', key: 'bookings', align: 'center' },
            { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', render: (r: number) => `$${r.toFixed(2)}` },
            { title: 'Therapist Fees', dataIndex: 'therapistFees', key: 'fees', render: (f: number) => `$${f.toFixed(2)}` },
            {
              title: 'Net Profit',
              dataIndex: 'netProfit',
              key: 'profit',
              render: (p: number) => <Text strong style={{ color: p >= 0 ? '#52c41a' : '#ff4d4f' }}>${p.toFixed(2)}</Text>,
            },
            { title: 'Avg Price', dataIndex: 'averagePrice', key: 'avgPrice', render: (p: number) => `$${p.toFixed(2)}` },
          ]}
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Bookings by Day of Week">
            <Table
              dataSource={bookingByDay}
              columns={[
                { title: 'Day', dataIndex: 'dayOfWeek', key: 'day' },
                { title: 'Bookings', dataIndex: 'count', key: 'count', align: 'center', render: (c: number) => <Tag color="blue">{c}</Tag> },
                { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', render: (r: number) => `$${r.toFixed(2)}` },
              ]}
              rowKey="dayOfWeek"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Bookings by Hour of Day">
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {bookingByHour.map(({ hour, count }) => (
                <div key={hour} style={{ marginBottom: 8 }}>
                  <Text>{hour.toString().padStart(2, '0')}:00</Text>
                  <Progress percent={(count / Math.max(...bookingByHour.map(b => b.count))) * 100} format={() => count} />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );

  const renderCustomersTab = () => (
    <>
      <Card title="Customer Overview" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Statistic title="Total Customers" value={customerInsights?.totalCustomers || 0} prefix={<UserOutlined />} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic title="New Customers" value={customerInsights?.newCustomers || 0} valueStyle={{ color: '#3f8600' }} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic title="Returning Customers" value={customerInsights?.returningCustomers || 0} valueStyle={{ color: '#1890ff' }} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic
              title="Retention Rate"
              value={customerInsights?.retentionRate || 0}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card>
            <Statistic
              title="Average Customer Lifetime Value"
              value={customerInsights?.averageLifetimeValue || 0}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#3f8600', fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Top 10 Customers by Spend">
            <Table
              dataSource={customerInsights?.topCustomers || []}
              columns={[
                { title: 'Name', dataIndex: 'name', key: 'name' },
                { title: 'Bookings', dataIndex: 'bookings', key: 'bookings', align: 'center' },
                { title: 'Total Spent', dataIndex: 'totalSpent', key: 'spent', render: (s: number) => `$${s.toFixed(2)}` },
              ]}
              rowKey="email"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </>
  );

  const renderMarketingTab = () => (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Gift Card Performance" extra={<GiftOutlined style={{ fontSize: 24, color: '#722ed1' }} />}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="Sold" value={giftCardData?.total_sold || 0} prefix={<ShoppingOutlined />} />
              </Col>
              <Col span={12}>
                <Statistic title="Total Sold" value={giftCardData?.total_sold_amount || 0} precision={2} prefix="$" />
              </Col>
              <Col span={12}>
                <Statistic title="Redeemed" value={giftCardData?.total_redeemed || 0} valueStyle={{ color: '#1890ff' }} />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Unredeemed (Profit)"
                  value={giftCardData?.unredeemed_balance || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Quote Performance" extra={<FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} />}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="Total Quotes" value={quoteData?.total_quotes || 0} />
              </Col>
              <Col span={12}>
                <Statistic title="Accepted" value={quoteData?.accepted_quotes || 0} valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Acceptance Rate"
                  value={quoteData?.acceptance_rate || 0}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Quote Revenue"
                  value={quoteData?.total_quote_revenue || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card title="Discount Code Performance" extra={<Button icon={<DownloadOutlined />} size="small">Export</Button>}>
        <Table
          dataSource={discountData}
          columns={[
            { title: 'Code', dataIndex: 'code', key: 'code' },
            { title: 'Usage', dataIndex: 'usage_count', key: 'usage', align: 'center' },
            { title: 'Total Discount', dataIndex: 'total_discount', key: 'discount', render: (d: number) => `$${d.toFixed(2)}` },
            { title: 'Revenue Generated', dataIndex: 'revenue_generated', key: 'revenue', render: (r: number) => `$${r.toFixed(2)}` },
            {
              title: 'ROI',
              dataIndex: 'roi',
              key: 'roi',
              render: (roi: number) => (
                <Tag color={roi >= 100 ? 'green' : 'orange'}>{roi.toFixed(0)}%</Tag>
              ),
            },
          ]}
          rowKey="code"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </>
  );

  const renderQuotesTab = () => (
    <>
      {/* Status Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Total Quotes"
              value={quoteMetrics?.total_quotes || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Draft"
              value={quoteMetrics?.draft_quotes || 0}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Sent"
              value={quoteMetrics?.sent_quotes || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Pending"
              value={quoteMetrics?.pending_quotes || 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Accepted"
              value={quoteMetrics?.accepted_quotes || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Declined"
              value={quoteMetrics?.declined_quotes || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<FallOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Response Time Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card title="Response Time Metrics" extra={<ClockCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />}>
            <Row gutter={[16, 16]}>
              <Col xs={12} lg={6}>
                <Statistic
                  title="Draft → Sent"
                  value={(quoteMetrics?.avg_draft_to_sent || 0).toFixed(1)}
                  suffix="hrs"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={12} lg={6}>
                <Statistic
                  title="Sent → Response"
                  value={(quoteMetrics?.avg_sent_to_response || 0).toFixed(1)}
                  suffix="hrs"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
              <Col xs={12} lg={6}>
                <Statistic
                  title="Response → Complete"
                  value={(quoteMetrics?.avg_response_to_completed || 0).toFixed(1)}
                  suffix="hrs"
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Col>
              <Col xs={12} lg={6}>
                <Statistic
                  title="Total Cycle Time"
                  value={(quoteMetrics?.avg_total_cycle_time || 0).toFixed(1)}
                  suffix="hrs"
                  valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Value Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Quote Value Metrics" extra={<DollarOutlined style={{ fontSize: 24, color: '#52c41a' }} />}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Total Quote Value"
                  value={quoteMetrics?.total_quote_value || 0}
                  precision={2}
                  prefix="$"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Accepted Value"
                  value={quoteMetrics?.accepted_quote_value || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Average Quote"
                  value={quoteMetrics?.average_quote_value || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Acceptance Rate"
                  value={quoteMetrics?.acceptance_rate || 0}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Conversion Funnel" extra={<PercentageOutlined style={{ fontSize: 24, color: '#722ed1' }} />}>
            <div style={{ padding: '20px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Draft → Sent</Text>
                <Progress
                  percent={quoteMetrics && quoteMetrics.total_quotes > 0 ? (quoteMetrics.sent_quotes / quoteMetrics.total_quotes) * 100 : 0}
                  strokeColor="#1890ff"
                  format={(percent) => `${percent?.toFixed(0)}%`}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Sent → Accepted</Text>
                <Progress
                  percent={quoteMetrics && quoteMetrics.sent_quotes > 0 ? (quoteMetrics.accepted_quotes / quoteMetrics.sent_quotes) * 100 : 0}
                  strokeColor="#52c41a"
                  format={(percent) => `${percent?.toFixed(0)}%`}
                />
              </div>
              <div>
                <Text strong>Overall Acceptance</Text>
                <Progress
                  percent={quoteMetrics?.acceptance_rate || 0}
                  strokeColor="#722ed1"
                  format={(percent) => `${percent?.toFixed(0)}%`}
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Quotes Table */}
      <Card
        title="Recent Quotes"
        extra={<Button icon={<DownloadOutlined />} size="small">Export</Button>}
      >
        <Table
          dataSource={quoteMetrics?.recentQuotes || []}
          columns={[
            {
              title: 'Quote #',
              dataIndex: 'quote_number',
              key: 'quote_number',
              width: 120,
            },
            {
              title: 'Customer',
              dataIndex: 'customer_name',
              key: 'customer_name',
            },
            {
              title: 'Value',
              dataIndex: 'total_price',
              key: 'total_price',
              render: (val: number) => `$${val.toFixed(2)}`,
              align: 'right' as const,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (status: string) => {
                const colors: Record<string, string> = {
                  draft: 'default',
                  sent: 'blue',
                  accepted: 'green',
                  declined: 'red',
                  completed: 'success',
                };
                return <Tag color={colors[status] || 'default'}>{status.toUpperCase()}</Tag>;
              },
            },
            {
              title: 'Created',
              dataIndex: 'created_at',
              key: 'created_at',
              render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
            },
            {
              title: 'Sent',
              dataIndex: 'sent_at',
              key: 'sent_at',
              render: (date: string | null) => date ? dayjs(date).format('MMM DD, YYYY') : '-',
            },
            {
              title: 'Response',
              dataIndex: 'accepted_at',
              key: 'response_at',
              render: (_: any, record: any) => {
                const responseDate = record.accepted_at || record.declined_at;
                return responseDate ? dayjs(responseDate).format('MMM DD, YYYY') : '-';
              },
            },
            {
              title: 'Days in Status',
              dataIndex: 'days_in_current_status',
              key: 'days_in_status',
              render: (days: number) => {
                const color = days > 7 ? '#ff4d4f' : days > 3 ? '#faad14' : '#52c41a';
                return <Tag color={color}>{days}d</Tag>;
              },
              align: 'center' as const,
            },
          ]}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </>
  );

  // ========== STYLED TAB LABELS ==========

  const createTabLabel = (icon: React.ReactNode, text: string, color: string, bgColor: string) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 16px',
      borderRadius: '8px',
      fontWeight: 600,
      fontSize: '14px',
      background: bgColor,
      color: color,
      transition: 'all 0.3s ease',
    }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>
      <span>{text}</span>
    </span>
  );

  // ========== MAIN RENDER ==========

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Business Reports</Title>

      {renderFilterBar()}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          items={[
            {
              key: 'overview',
              label: createTabLabel(<DollarOutlined />, 'Overview', '#1890ff', '#e6f4ff'),
              children: renderOverviewTab()
            },
            {
              key: 'financials',
              label: createTabLabel(<CalendarOutlined />, 'Financials', '#52c41a', '#f6ffed'),
              children: renderFinancialsTab()
            },
            {
              key: 'team',
              label: createTabLabel(<TeamOutlined />, 'Team Performance', '#722ed1', '#f9f0ff'),
              children: renderTeamTab()
            },
            {
              key: 'services',
              label: createTabLabel(<ShoppingOutlined />, 'Services & Bookings', '#fa8c16', '#fff7e6'),
              children: renderServicesTab()
            },
            {
              key: 'customers',
              label: createTabLabel(<UserOutlined />, 'Customers', '#eb2f96', '#fff0f6'),
              children: renderCustomersTab()
            },
            {
              key: 'quotes',
              label: createTabLabel(<FileTextOutlined />, 'Quotes', '#f5222d', '#fff1f0'),
              children: renderQuotesTab()
            },
            {
              key: 'marketing',
              label: createTabLabel(<GiftOutlined />, 'Marketing', '#13c2c2', '#e6fffb'),
              children: renderMarketingTab()
            },
          ]}
        />
      )}
    </div>
  );
};

export default Reports;
