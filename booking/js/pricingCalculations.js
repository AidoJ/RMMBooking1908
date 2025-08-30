/**
 * Pricing Calculations Module
 * Handles discount codes, gift cards, and GST calculations for the booking platform
 */

// Initialize pricing variables
window.pricingState = {
  grossPrice: 0,
  appliedDiscount: null,
  appliedGiftCard: null,
  discountAmount: 0,
  giftCardAmount: 0,
  taxRate: 10, // 10% GST
  finalPricing: null
};

/**
 * Calculate pricing breakdown with discounts and GST
 */
function calculatePricing(grossPrice, appliedDiscount = null, giftCardAmount = 0, taxRate = 10) {
  // Calculate discount amount
  let discountAmount = 0;
  if (appliedDiscount) {
    if (appliedDiscount.type === 'percentage') {
      discountAmount = (grossPrice * appliedDiscount.value) / 100;
      if (appliedDiscount.max_discount_amount && discountAmount > appliedDiscount.max_discount_amount) {
        discountAmount = appliedDiscount.max_discount_amount;
      }
    } else if (appliedDiscount.type === 'fixed_amount') {
      discountAmount = Math.min(appliedDiscount.value, grossPrice);
    }
  }

  // Apply discount first
  const priceAfterDiscount = Math.max(0, grossPrice - discountAmount);
  
  // Apply gift card (can't exceed remaining amount)
  const giftCardUsed = Math.min(giftCardAmount, priceAfterDiscount);
  const priceAfterGiftCard = priceAfterDiscount - giftCardUsed;
  
  // Calculate GST on final amount (after discounts and gift cards)
  const taxAmount = (priceAfterGiftCard * taxRate) / 100;
  const netPrice = priceAfterGiftCard + taxAmount;

  return {
    grossPrice: grossPrice,
    discountAmount: discountAmount,
    giftCardAmount: giftCardUsed,
    priceAfterDiscount: priceAfterDiscount,
    priceAfterGiftCard: priceAfterGiftCard,
    taxAmount: taxAmount,
    netPrice: netPrice,
    appliedDiscount: appliedDiscount,
    appliedGiftCardAmount: giftCardUsed
  };
}

/**
 * Validate discount code against database
 */
async function validateDiscountCode(code) {
  if (!code || code.trim() === '') {
    return { valid: false, error: 'Please enter a discount code' };
  }

  try {
    const { data: discount, error } = await window.supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Discount validation error:', error);
      return { valid: false, error: 'Invalid discount code' };
    }

    // Check if discount is expired
    if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
      return { valid: false, error: 'This discount code has expired' };
    }

    // Check usage limits
    if (discount.usage_limit && discount.used_count >= discount.usage_limit) {
      return { valid: false, error: 'This discount code has reached its usage limit' };
    }

    return { valid: true, discount: discount };
  } catch (error) {
    console.error('Error validating discount code:', error);
    return { valid: false, error: 'Error validating discount code. Please try again.' };
  }
}

/**
 * Validate gift card code and get available balance
 */
async function validateGiftCard(code) {
  if (!code || code.trim() === '') {
    return { valid: false, error: 'Please enter a gift card code' };
  }

  try {
    const { data: giftCard, error } = await window.supabase
      .from('gift_cards')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Gift card validation error:', error);
      return { valid: false, error: 'Invalid gift card code' };
    }

    // Check if gift card is expired
    if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
      return { valid: false, error: 'This gift card has expired' };
    }

    // Check if gift card has balance
    if (giftCard.remaining_balance <= 0) {
      return { valid: false, error: 'This gift card has no remaining balance' };
    }

    return { 
      valid: true, 
      giftCard: giftCard,
      availableBalance: giftCard.remaining_balance
    };
  } catch (error) {
    console.error('Error validating gift card:', error);
    return { valid: false, error: 'Error validating gift card. Please try again.' };
  }
}

/**
 * Apply discount code
 */
async function applyDiscountCode() {
  const codeInput = document.getElementById('promoCode');
  const statusDiv = document.getElementById('promoStatus');
  const applyBtn = document.getElementById('applyPromoBtn');
  
  const code = codeInput.value.trim();
  
  if (!code) {
    showMessage(statusDiv, 'Please enter a discount code', 'error');
    return;
  }

  // Disable button while processing
  applyBtn.disabled = true;
  applyBtn.textContent = 'Applying...';
  
  try {
    const result = await validateDiscountCode(code);
    
    if (result.valid) {
      // Store applied discount
      window.pricingState.appliedDiscount = result.discount;
      
      // Update pricing display
      updatePricingDisplay();
      
      showMessage(statusDiv, `✅ ${result.discount.description} applied!`, 'success');
      applyBtn.textContent = 'Applied';
      codeInput.disabled = true;
    } else {
      showMessage(statusDiv, result.error, 'error');
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply';
    }
  } catch (error) {
    console.error('Error applying discount:', error);
    showMessage(statusDiv, 'Error applying discount. Please try again.', 'error');
    applyBtn.disabled = false;
    applyBtn.textContent = 'Apply';
  }
}

/**
 * Apply gift card
 */
async function applyGiftCard() {
  const codeInput = document.getElementById('giftCard');
  const statusDiv = document.getElementById('giftCardStatus');
  const applyBtn = document.getElementById('applyGiftCardBtn');
  
  const code = codeInput.value.trim();
  
  if (!code) {
    showMessage(statusDiv, 'Please enter a gift card code', 'error');
    return;
  }

  // Disable button while processing
  applyBtn.disabled = true;
  applyBtn.textContent = 'Applying...';
  
  try {
    const result = await validateGiftCard(code);
    
    if (result.valid) {
      // Store applied gift card
      window.pricingState.appliedGiftCard = result.giftCard;
      
      // Update pricing display
      updatePricingDisplay();
      
      showMessage(statusDiv, `✅ Gift card applied! Available: $${result.availableBalance.toFixed(2)}`, 'success');
      applyBtn.textContent = 'Applied';
      codeInput.disabled = true;
    } else {
      showMessage(statusDiv, result.error, 'error');
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply';
    }
  } catch (error) {
    console.error('Error applying gift card:', error);
    showMessage(statusDiv, 'Error applying gift card. Please try again.', 'error');
    applyBtn.disabled = false;
    applyBtn.textContent = 'Apply';
  }
}

/**
 * Update pricing display with current calculations
 */
function updatePricingDisplay() {
  const grossPrice = window.pricingState.grossPrice;
  
  if (grossPrice <= 0) return;

  const giftCardAmount = window.pricingState.appliedGiftCard ? 
    window.pricingState.appliedGiftCard.remaining_balance : 0;
  
  const pricing = calculatePricing(
    grossPrice,
    window.pricingState.appliedDiscount,
    giftCardAmount,
    window.pricingState.taxRate
  );
  
  // Store final pricing
  window.pricingState.finalPricing = pricing;
  window.pricingState.discountAmount = pricing.discountAmount;
  window.pricingState.giftCardAmount = pricing.giftCardAmount;

  // Show discount/gift card sections if price is available
  if (grossPrice > 0) {
    document.getElementById('discountSection').style.display = 'block';
  }

  // Update the main price display with final net price
  const priceAmountElement = document.getElementById('priceAmount');
  if (priceAmountElement && (pricing.discountAmount > 0 || pricing.giftCardAmount > 0)) {
    priceAmountElement.textContent = pricing.netPrice.toFixed(2);
  }

  // Update pricing breakdown
  document.getElementById('subtotalAmount').textContent = `$${pricing.grossPrice.toFixed(2)}`;
  document.getElementById('gstAmount').textContent = `$${pricing.taxAmount.toFixed(2)}`;
  document.getElementById('totalAmount').textContent = `$${pricing.netPrice.toFixed(2)}`;

  // Show/hide discount line
  const discountLine = document.getElementById('discountLine');
  if (pricing.discountAmount > 0) {
    discountLine.style.display = 'flex';
    document.getElementById('appliedDiscountCode').textContent = pricing.appliedDiscount.code;
    document.getElementById('discountAmount').textContent = `-$${pricing.discountAmount.toFixed(2)}`;
  } else {
    discountLine.style.display = 'none';
  }

  // Show/hide gift card line
  const giftCardLine = document.getElementById('giftCardLine');
  if (pricing.giftCardAmount > 0) {
    giftCardLine.style.display = 'flex';
    document.getElementById('appliedGiftCardCode').textContent = window.pricingState.appliedGiftCard.code;
    document.getElementById('giftCardAmount').textContent = `-$${pricing.giftCardAmount.toFixed(2)}`;
  } else {
    giftCardLine.style.display = 'none';
  }

  // Show final pricing breakdown
  if (pricing.discountAmount > 0 || pricing.giftCardAmount > 0) {
    document.getElementById('finalPricingBreakdown').style.display = 'block';
  }
}

/**
 * Set the gross price and trigger pricing updates
 */
function setGrossPrice(price) {
  window.pricingState.grossPrice = parseFloat(price) || 0;
  updatePricingDisplay();
}

/**
 * Show status messages
 */
function showMessage(element, message, type) {
  element.textContent = message;
  element.className = `status-message status-${type}`;
  element.style.display = 'block';
}

/**
 * Initialize pricing system when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
  // Add event listeners for discount and gift card buttons
  const promoBtn = document.getElementById('applyPromoBtn');
  const giftCardBtn = document.getElementById('applyGiftCardBtn');
  
  if (promoBtn) {
    promoBtn.addEventListener('click', applyDiscountCode);
  }
  
  if (giftCardBtn) {
    giftCardBtn.addEventListener('click', applyGiftCard);
  }

  // Add enter key support for inputs
  const promoInput = document.getElementById('promoCode');
  const giftCardInput = document.getElementById('giftCard');
  
  if (promoInput) {
    promoInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyDiscountCode();
      }
    });
  }
  
  if (giftCardInput) {
    giftCardInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyGiftCard();
      }
    });
  }
});

// Export functions for use in other scripts
window.pricingCalculations = {
  calculatePricing,
  validateDiscountCode,
  validateGiftCard,
  applyDiscountCode,
  applyGiftCard,
  updatePricingDisplay,
  setGrossPrice,
  showMessage
};