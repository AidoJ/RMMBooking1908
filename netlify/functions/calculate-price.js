/**
 * Calculate Price Function
 *
 * Calculates the price for a booking including time-based uplifts.
 * Used by the client reschedule page.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const {
      service_id,
      duration,
      booking_time
    } = event.queryStringParameters || {};

    if (!service_id || !booking_time) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'service_id and booking_time are required' })
      };
    }

    const durationMinutes = parseInt(duration) || 60;

    // Get service base price
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('service_base_price, name')
      .eq('id', service_id)
      .single();

    if (serviceError || !service) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Service not found' })
      };
    }

    let price = service.service_base_price;
    const breakdown = {
      basePrice: service.service_base_price,
      service: service.name,
      duration: durationMinutes,
      durationUplift: 0,
      timeUplift: 0,
      timeUpliftLabel: null
    };

    // Apply duration uplift
    const { data: durationPricing } = await supabase
      .from('duration_pricing')
      .select('uplift_percentage')
      .eq('duration_minutes', durationMinutes)
      .eq('is_active', true)
      .single();

    if (durationPricing && durationPricing.uplift_percentage > 0) {
      breakdown.durationUplift = durationPricing.uplift_percentage;
      price = price * (1 + durationPricing.uplift_percentage / 100);
    }

    // Apply duration multiplier (base price is typically per hour)
    price = price * (durationMinutes / 60);

    // Parse booking time for time-based pricing
    const bookingDate = new Date(booking_time);
    const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday
    const timeString = bookingDate.toTimeString().substring(0, 5); // HH:MM

    console.log('📅 Time pricing lookup:', { booking_time, dayOfWeek, timeString });

    // Get ALL time pricing rules (not filtered by day) to see what's in the table
    const { data: allTimeRules, error: timeRulesError } = await supabase
      .from('time_pricing_rules')
      .select('*')
      .eq('is_active', true);

    console.log('📋 All time pricing rules:', JSON.stringify(allTimeRules, null, 2));
    if (timeRulesError) console.error('❌ Time rules error:', timeRulesError);

    // Filter rules for this day
    const timeRules = (allTimeRules || []).filter(rule => Number(rule.day_of_week) === dayOfWeek);
    console.log('📋 Rules for day', dayOfWeek, ':', timeRules.length, 'rules');

    // Find applicable time rules
    if (timeRules && timeRules.length > 0) {
      let maxUplift = 0;
      let appliedLabel = null;

      for (const rule of timeRules) {
        console.log('🔍 Checking rule:', rule.label, 'start:', rule.start_time, 'end:', rule.end_time, 'time:', timeString);
        // Check if the booking time falls within this rule's time range
        if (timeString >= rule.start_time && timeString < rule.end_time) {
          console.log('✅ Rule matches!', rule.label, 'uplift:', rule.uplift_percentage);
          if (rule.uplift_percentage > maxUplift) {
            maxUplift = rule.uplift_percentage;
            appliedLabel = rule.label;
          }
        }
      }

      if (maxUplift > 0) {
        breakdown.timeUplift = maxUplift;
        breakdown.timeUpliftLabel = appliedLabel;
        const upliftAmount = price * (maxUplift / 100);
        price = price + upliftAmount;
        console.log('💰 Applied uplift:', maxUplift, '% =', upliftAmount, 'New price:', price);
      }
    } else {
      console.log('ℹ️ No time pricing rules found for day', dayOfWeek);
    }

    // Round to 2 decimal places
    price = Math.round(price * 100) / 100;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        price,
        breakdown
      })
    };

  } catch (error) {
    console.error('Calculate price error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to calculate price', message: error.message })
    };
  }
};
