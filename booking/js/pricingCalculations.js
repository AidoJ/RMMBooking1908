/**
 * Simple Discount & Gift Card System
 * Works with existing calculatePrice function
 */

// Simple global variables
window.appliedDiscount = null;
window.appliedGiftCard = null;

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
 * Apply discount code - Simple version
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

  applyBtn.disabled = true;
  applyBtn.textContent = 'Checking...';
  
  try {
    const result = await validateDiscountCode(code);
    
    if (result.valid) {
      // Store discount and trigger price recalculation
      window.appliedDiscount = result.discount;
      calculatePrice(); // Trigger existing price calculation
      
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
 * Apply gift card - Simple version
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

  applyBtn.disabled = true;
  applyBtn.textContent = 'Checking...';
  
  try {
    const result = await validateGiftCard(code);
    
    if (result.valid) {
      // Store gift card and trigger price recalculation
      window.appliedGiftCard = result.giftCard;
      calculatePrice(); // Trigger existing price calculation
      
      showMessage(statusDiv, `✅ Gift card applied!`, 'success');
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
 * Show discount section when price is available
 */
function showDiscountSection() {
  const grossPrice = window.grossPrice;
  if (grossPrice && grossPrice > 0) {
    document.getElementById('discountSection').style.display = 'block';
  }
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