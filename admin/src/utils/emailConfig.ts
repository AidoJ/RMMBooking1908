// Centralized email configuration for the platform
export interface EmailConfig {
  adminNotificationEmail: string;
  businessContactEmail: string;
  businessName: string;
  businessPhone: string;
}

// Default configuration - can be overridden by system settings
export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  adminNotificationEmail: 'info@rejuvenators.com',
  businessContactEmail: 'info@rejuvenators.com', 
  businessName: 'Rejuvenators Mobile Massage',
  businessPhone: '1300 302 542'
};

// Email configuration service
class EmailConfigService {
  private config: EmailConfig = DEFAULT_EMAIL_CONFIG;

  // Get current configuration
  getConfig(): EmailConfig {
    return { ...this.config };
  }

  // Get admin notification email
  getAdminEmail(): string {
    return this.config.adminNotificationEmail;
  }

  // Get business contact email  
  getBusinessEmail(): string {
    return this.config.businessContactEmail;
  }

  // Get business name
  getBusinessName(): string {
    return this.config.businessName;
  }

  // Get business phone
  getBusinessPhone(): string {
    return this.config.businessPhone;
  }

  // Update configuration (for future system settings integration)
  updateConfig(newConfig: Partial<EmailConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Load configuration from system settings (placeholder for Phase 2)
  async loadFromSystemSettings(): Promise<void> {
    // TODO: Phase 2 - Load from database system_settings table
    // For now, use defaults
    console.log('Using default email configuration');
  }
}

// Export singleton instance
export const emailConfigService = new EmailConfigService();

// Utility functions for easy access
export const getAdminNotificationEmail = (): string => emailConfigService.getAdminEmail();
export const getBusinessContactEmail = (): string => emailConfigService.getBusinessEmail();
export const getBusinessName = (): string => emailConfigService.getBusinessName();
export const getBusinessPhone = (): string => emailConfigService.getBusinessPhone();