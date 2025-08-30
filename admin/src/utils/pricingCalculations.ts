/**
 * Centralized Pricing Calculation System
 * Handles all pricing logic including GST, discounts, and gift cards
 */

export interface PricingBreakdown {
  grossPrice: number;
  discountAmount: number;
  discountType?: 'fixed_amount' | 'percentage';
  discountCode?: string;
  giftCardAmount: number;
  giftCardCode?: string;
  taxRate: number; // percentage (e.g., 10 for 10%)
  taxAmount: number;
  netPrice: number;
  finalAmount: number; // Amount customer pays after all deductions
}

export interface DiscountCode {
  id: string;
  code: string;
  description: string;
  discountType: 'fixed_amount' | 'percentage';
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  validFrom: Date;
  validUntil?: Date;
  isActive: boolean;
}

export interface GiftCard {
  id: string;
  code: string;
  currentBalance: number;
  expiresAt?: Date;
  isActive: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  amount?: number;
  message: string;
}

export class PricingCalculator {
  private static readonly DEFAULT_TAX_RATE = 10; // 10% GST
  
  /**
   * Calculate complete pricing breakdown
   */
  static calculatePricing(params: {
    grossPrice: number;
    discountCode?: DiscountCode;
    giftCardAmount?: number;
    taxRate?: number;
  }): PricingBreakdown {
    const { grossPrice, discountCode, giftCardAmount = 0, taxRate = this.DEFAULT_TAX_RATE } = params;
    
    // Step 1: Apply discount to gross price
    const discountAmount = discountCode ? 
      this.calculateDiscountAmount(grossPrice, discountCode) : 0;
    
    const priceAfterDiscount = Math.max(0, grossPrice - discountAmount);
    
    // Step 2: Calculate tax on discounted amount
    const taxAmount = this.calculateTaxAmount(priceAfterDiscount, taxRate);
    
    // Step 3: Calculate net price (price + tax)
    const netPrice = priceAfterDiscount + taxAmount;
    
    // Step 4: Apply gift card (cannot exceed net price)
    const actualGiftCardAmount = Math.min(giftCardAmount, netPrice);
    
    // Step 5: Final amount customer pays
    const finalAmount = Math.max(0, netPrice - actualGiftCardAmount);
    
    return {
      grossPrice,
      discountAmount,
      discountType: discountCode?.discountType,
      discountCode: discountCode?.code,
      giftCardAmount: actualGiftCardAmount,
      taxRate,
      taxAmount,
      netPrice,
      finalAmount
    };
  }
  
  /**
   * Calculate discount amount based on discount code
   */
  private static calculateDiscountAmount(grossPrice: number, discountCode: DiscountCode): number {
    let discount = 0;
    
    if (discountCode.discountType === 'percentage') {
      discount = grossPrice * (discountCode.discountValue / 100);
    } else {
      discount = discountCode.discountValue;
    }
    
    // Apply maximum discount limit if set
    if (discountCode.maximumDiscountAmount) {
      discount = Math.min(discount, discountCode.maximumDiscountAmount);
    }
    
    // Discount cannot exceed gross price
    return Math.min(discount, grossPrice);
  }
  
  /**
   * Calculate tax amount
   */
  private static calculateTaxAmount(amount: number, taxRate: number): number {
    return Math.round((amount * (taxRate / 100)) * 100) / 100; // Round to 2 decimal places
  }
  
  /**
   * Validate discount code
   */
  static validateDiscountCode(
    code: string, 
    discountCode: DiscountCode | null, 
    orderAmount: number
  ): ValidationResult {
    if (!discountCode) {
      return { isValid: false, message: 'Invalid discount code' };
    }
    
    // Check if active
    if (!discountCode.isActive) {
      return { isValid: false, message: 'Discount code is not active' };
    }
    
    // Check validity period
    const now = new Date();
    if (discountCode.validFrom > now) {
      return { isValid: false, message: 'Discount code not yet valid' };
    }
    
    if (discountCode.validUntil && discountCode.validUntil < now) {
      return { isValid: false, message: 'Discount code has expired' };
    }
    
    // Check usage limit
    if (discountCode.usageLimit && discountCode.usageCount >= discountCode.usageLimit) {
      return { isValid: false, message: 'Discount code usage limit reached' };
    }
    
    // Check minimum order amount
    if (orderAmount < discountCode.minimumOrderAmount) {
      return { 
        isValid: false, 
        message: `Order must be at least $${discountCode.minimumOrderAmount.toFixed(2)} to use this code` 
      };
    }
    
    // Calculate discount amount
    const discountAmount = this.calculateDiscountAmount(orderAmount, discountCode);
    
    return { 
      isValid: true, 
      amount: discountAmount,
      message: 'Discount code valid' 
    };
  }
  
  /**
   * Validate gift card
   */
  static validateGiftCard(
    code: string,
    giftCard: GiftCard | null
  ): ValidationResult {
    if (!giftCard) {
      return { isValid: false, message: 'Invalid gift card code' };
    }
    
    // Check if active
    if (!giftCard.isActive) {
      return { isValid: false, message: 'Gift card is not active' };
    }
    
    // Check expiry
    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
      return { isValid: false, message: 'Gift card has expired' };
    }
    
    // Check balance
    if (giftCard.currentBalance <= 0) {
      return { isValid: false, message: 'Gift card has no remaining balance' };
    }
    
    return { 
      isValid: true, 
      amount: giftCard.currentBalance,
      message: 'Gift card valid' 
    };
  }
  
  /**
   * Format currency amount for display
   */
  static formatCurrency(amount: number, currency: string = 'AUD'): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }
  
  /**
   * Calculate therapist fee from booking price
   * (This integrates with existing fee calculation system)
   */
  static calculateTherapistFee(
    bookingPrice: number,
    therapistRatePerHour: number,
    durationMinutes: number
  ): number {
    const hours = durationMinutes / 60;
    return Math.round(therapistRatePerHour * hours * 100) / 100;
  }
  
  /**
   * Generate pricing summary text for display
   */
  static generatePricingSummary(breakdown: PricingBreakdown): string[] {
    const summary: string[] = [];
    
    summary.push(`Subtotal: ${this.formatCurrency(breakdown.grossPrice)}`);
    
    if (breakdown.discountAmount > 0) {
      summary.push(`Discount (${breakdown.discountCode}): -${this.formatCurrency(breakdown.discountAmount)}`);
    }
    
    if (breakdown.taxAmount > 0) {
      summary.push(`GST (${breakdown.taxRate}%): ${this.formatCurrency(breakdown.taxAmount)}`);
    }
    
    summary.push(`Total: ${this.formatCurrency(breakdown.netPrice)}`);
    
    if (breakdown.giftCardAmount > 0) {
      summary.push(`Gift Card Applied: -${this.formatCurrency(breakdown.giftCardAmount)}`);
      summary.push(`Amount Due: ${this.formatCurrency(breakdown.finalAmount)}`);
    }
    
    return summary;
  }
  
  /**
   * Generate booking data for database with pricing fields
   */
  static generateBookingPricingData(breakdown: PricingBreakdown) {
    return {
      price: breakdown.grossPrice,
      discount_amount: breakdown.discountAmount,
      tax_rate_amount: breakdown.taxRate,
      net_price: breakdown.netPrice,
      discount_code: breakdown.discountCode || null,
      gift_card_code: breakdown.giftCardCode || null,
      gift_card_amount: breakdown.giftCardAmount
    };
  }
}

/**
 * React hook for pricing calculations
 */
export function usePricingCalculator(
  grossPrice: number,
  discountCode?: DiscountCode | null,
  giftCardAmount?: number,
  taxRate?: number
) {
  const breakdown = PricingCalculator.calculatePricing({
    grossPrice,
    discountCode: discountCode || undefined,
    giftCardAmount,
    taxRate
  });
  
  const summary = PricingCalculator.generatePricingSummary(breakdown);
  const formattedFinalAmount = PricingCalculator.formatCurrency(breakdown.finalAmount);
  
  return {
    breakdown,
    summary,
    formattedFinalAmount,
    isDiscountApplied: breakdown.discountAmount > 0,
    isGiftCardApplied: breakdown.giftCardAmount > 0,
    hasBalance: breakdown.finalAmount > 0
  };
}

/**
 * Constants for pricing system
 */
export const PRICING_CONSTANTS = {
  DEFAULT_TAX_RATE: 10,
  CURRENCY_CODE: 'AUD',
  CURRENCY_SYMBOL: '$',
  MIN_PRICE: 0.01,
  MAX_DISCOUNT_PERCENTAGE: 100,
  DEFAULT_GIFT_CARD_EXPIRY_MONTHS: 24
} as const;

export default PricingCalculator;