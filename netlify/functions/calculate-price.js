/**
 * Calculate Price Function
 *
 * Calculates the price for a booking including time-based uplifts.
 * Used by the client reschedule page.
 *
 * For reschedule mode (when original_price and original_booking_time are provided):
 * - Uses original_price as the base
 * - Only calculates time-based uplift DIFFERENCE between old and new time
 * - Does NOT apply duration multiplier (since duration cannot change in reschedule)
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to get time-based uplift percentage for a given booking time
async function getTimeUpliftPercentage(bookingTime) {
  const bookingDate = new Date(bookingTime);
  const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday
  const timeString = bookingDate.toTimeString().substring(0, 5); // HH:MM

  console.log(`📅 Checking time uplift for day ${dayOfWeek}, time ${timeString}`);

  // Get ALL active time pricing rules
  const { data: allRules, error } = await supabase
    .from('time_pricing_rules')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('❌ Error fetching time rules:', error);
    return 0;
  }

  // Filter rules for this day of week
  const dayRules = (allRules || []).filter(rule => Number(rule.day_of_week) === dayOfWeek);
  console.log(`📋 Rules for day ${dayOfWeek}: ${dayRules.length}`);

  // Find matching rules where booking time is within the time range
  let maxUplift = 0;
  let appliedLabel = null;

  for (const rule of dayRules) {
    console.log(`🔍 Checking rule: ${rule.label}, start: ${rule.start_time}, end: ${rule.end_time}`);
    if (timeString >= rule.start_time && timeString < rule.end_time) {
      console.log(`✅ Rule matches! Uplift: ${rule.uplift_percentage}%`);
      if (rule.uplift_percentage > maxUplift) {
        maxUplift = rule.uplift_percentage;
        appliedLabel = rule.label;
      }
    }
  }

  if (maxUplift > 0) {
    console.log(`📈 Max time uplift: ${maxUplift}% (${appliedLabel})`);
  } else {
    console.log(`ℹ️ No time uplift applies`);
  }

  return { uplift: maxUplift, label: appliedLabel };
}

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
      booking_time,
      original_price,
      original_booking_time
    } = event.queryStringParameters || {};

    if (!booking_time) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'booking_time is required' })
      };
    }

    // RESCHEDULE MODE: Use original price and only calculate time uplift difference
    if (original_price && original_booking_time) {
      console.log('📅 RESCHEDULE MODE - calculating price difference');
      console.log(`   Original price: $${original_price}`);
      console.log(`   Original time: ${original_booking_time}`);
      console.log(`   New time: ${booking_time}`);

      const origPrice = parseFloat(original_price);

      // Get time uplift for original booking time
      const originalUpliftResult = await getTimeUpliftPercentage(original_booking_time);
      const originalUplift = originalUpliftResult.uplift;
      console.log(`   Original time uplift: ${originalUplift}%`);

      // Get time uplift for new booking time
      const newUpliftResult = await getTimeUpliftPercentage(booking_time);
      const newUplift = newUpliftResult.uplift;
      console.log(`   New time uplift: ${newUplift}%`);

      let newPrice = origPrice;
      let priceDifference = 0;

      // If new time has higher uplift, calculate the additional charge
      if (newUplift > originalUplift) {
        // Calculate the base price (original price without its time uplift)
        const basePrice = origPrice / (1 + originalUplift / 100);
        console.log(`   Base price (without uplift): $${basePrice.toFixed(2)}`);

        // Calculate new price with new uplift
        newPrice = basePrice * (1 + newUplift / 100);
        console.log(`   New price (with ${newUplift}% uplift): $${newPrice.toFixed(2)}`);

        priceDifference = newPrice - origPrice;
        console.log(`   Price difference: $${priceDifference.toFixed(2)}`);
      } else {
        console.log(`   No additional charge (new uplift ${newUplift}% <= original uplift ${originalUplift}%)`);
      }

      // Round to 2 decimal places
      newPrice = Math.round(newPrice * 100) / 100;
      priceDifference = Math.round(priceDifference * 100) / 100;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          price: newPrice,
          priceDifference,
          breakdown: {
            originalPrice: origPrice,
            originalUplift,
            newUplift,
            timeUpliftLabel: newUpliftResult.label,
            isReschedule: true
          }
        })
      };
    }

    // STANDARD MODE: Calculate full price from scratch (for new bookings)
    if (!service_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'service_id is required for new booking price calculation' })
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

    // Get time-based uplift
    const timeUpliftResult = await getTimeUpliftPercentage(booking_time);

    if (timeUpliftResult.uplift > 0) {
      breakdown.timeUplift = timeUpliftResult.uplift;
      breakdown.timeUpliftLabel = timeUpliftResult.label;
      const upliftAmount = price * (timeUpliftResult.uplift / 100);
      price = price + upliftAmount;
      console.log('💰 Applied uplift:', timeUpliftResult.uplift, '% =', upliftAmount, 'New price:', price);
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
