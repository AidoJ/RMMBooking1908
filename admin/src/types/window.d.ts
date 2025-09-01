declare global {
  interface Window {
    EmailService: {
      sendGiftCardEmail(giftCardData: any, sendToRecipient?: boolean): Promise<{
        success: boolean;
        message?: string;
        error?: string;
        sentTo?: string;
      }>;
    };
  }
}

export {};