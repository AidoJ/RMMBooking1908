import jsPDF from 'jspdf';

interface QuoteData {
  // Contact Information
  corporate_contact_name: string;
  business_name?: string;
  corporate_contact_email: string;
  corporate_contact_phone: string;
  
  // Event Details
  address: string;
  booking_time: string;
  event_type?: string;
  expected_attendees?: number;
  
  // Massage Requirements
  number_of_massages: number;
  duration_per_massage: number;
  preferred_therapists?: number;
  urgency?: string;
  
  // Payment & Setup
  payment_method?: string;
  po_number?: string;
  setup_requirements?: string;
  special_requirements?: string;
  
  // Pricing
  price?: number;
  
  // Metadata
  id: string;
  created_at: string;
}

export class QuotePDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  generateQuotePDF(quoteData: QuoteData): void {
    this.addHeader();
    this.addQuoteDetails(quoteData);
    this.addContactInformation(quoteData);
    this.addEventDetails(quoteData);
    this.addMassageRequirements(quoteData);
    this.addPricingBreakdown(quoteData);
    this.addTermsAndConditions();
    this.addFooter();
  }

  private addHeader(): void {
    // Company branding
    this.doc.setFontSize(24);
    this.doc.setTextColor(0, 126, 140); // #007e8c
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('REJUVENATORS®', this.margin, this.currentY);
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'italic');
    this.doc.text('Mobile Massage', this.margin, this.currentY + 8);
    
    // Official Quote title
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('OFFICIAL QUOTE', this.pageWidth - this.margin - 50, this.currentY);
    
    this.currentY += 25;
    this.addLine();
  }

  private addQuoteDetails(quoteData: QuoteData): void {
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    
    const quoteRef = quoteData.id.substring(0, 8).toUpperCase();
    const quoteDate = new Date(quoteData.created_at).toLocaleDateString('en-AU');
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU');
    
    this.doc.text(`Quote Reference: ${quoteRef}`, this.margin, this.currentY);
    this.doc.text(`Quote Date: ${quoteDate}`, this.margin, this.currentY + 5);
    this.doc.text(`Valid Until: ${validUntil}`, this.margin, this.currentY + 10);
    
    this.currentY += 20;
  }

  private addContactInformation(quoteData: QuoteData): void {
    this.addSectionHeader('Contact Information');
    
    this.addDetailRow('Contact Name:', quoteData.corporate_contact_name);
    this.addDetailRow('Company:', quoteData.business_name || 'Not specified');
    this.addDetailRow('Email:', quoteData.corporate_contact_email);
    this.addDetailRow('Phone:', quoteData.corporate_contact_phone);
    
    this.currentY += 5;
  }

  private addEventDetails(quoteData: QuoteData): void {
    this.addSectionHeader('Event Details');
    
    const eventDate = new Date(quoteData.booking_time).toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    this.addDetailRow('Event Date:', eventDate);
    this.addDetailRow('Event Address:', quoteData.address);
    this.addDetailRow('Event Type:', quoteData.event_type || 'Corporate Event');
    this.addDetailRow('Expected Attendees:', (quoteData.expected_attendees || 'Not specified').toString());
    
    this.currentY += 5;
  }

  private addMassageRequirements(quoteData: QuoteData): void {
    this.addSectionHeader('Massage Requirements');
    
    const totalMinutes = quoteData.number_of_massages * quoteData.duration_per_massage;
    const totalDuration = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
    
    this.addDetailRow('Number of Massages:', quoteData.number_of_massages.toString());
    this.addDetailRow('Duration per Massage:', `${quoteData.duration_per_massage} minutes`);
    this.addDetailRow('Total Event Duration:', totalDuration);
    this.addDetailRow('Preferred Therapists:', (quoteData.preferred_therapists || 'Let us recommend').toString());
    
    if (quoteData.setup_requirements) {
      this.addDetailRow('Setup Requirements:', quoteData.setup_requirements);
    }
    
    if (quoteData.special_requirements) {
      this.addDetailRow('Special Requirements:', quoteData.special_requirements);
    }
    
    this.currentY += 5;
  }

  private addPricingBreakdown(quoteData: QuoteData): void {
    this.addSectionHeader('Investment');
    
    // Add pricing box
    const boxY = this.currentY;
    const boxHeight = 20;
    
    this.doc.setFillColor(240, 248, 255); // Light blue background
    this.doc.rect(this.margin, boxY, this.pageWidth - 2 * this.margin, boxHeight, 'F');
    this.doc.setDrawColor(0, 126, 140);
    this.doc.rect(this.margin, boxY, this.pageWidth - 2 * this.margin, boxHeight);
    
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 126, 140);
    this.doc.text('Total Investment:', this.margin + 5, boxY + 8);
    
    const price = quoteData.price || 0;
    this.doc.text(`$${price.toFixed(2)}`, this.pageWidth - this.margin - 30, boxY + 8);
    
    this.currentY = boxY + boxHeight + 10;
    
    // Payment details
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    
    if (quoteData.payment_method) {
      this.addDetailRow('Payment Method:', this.formatPaymentMethod(quoteData.payment_method));
    }
    
    if (quoteData.po_number) {
      this.addDetailRow('PO Number:', quoteData.po_number);
    }
    
    this.currentY += 5;
  }

  private addTermsAndConditions(): void {
    this.addSectionHeader('Terms & Conditions');
    
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    
    const terms = [
      '• This quote is valid for 30 days from the date of issue',
      '• Prices include GST where applicable',
      '• Payment is required within 7 days of service completion',
      '• Cancellation must be made at least 24 hours in advance',
      '• All therapists are fully qualified and insured',
      '• Equipment and massage tables will be provided by Rejuvenators',
      '• A suitable private space must be provided for each treatment'
    ];
    
    terms.forEach((term, index) => {
      this.doc.text(term, this.margin, this.currentY + (index * 4));
    });
    
    this.currentY += terms.length * 4 + 10;
  }

  private addFooter(): void {
    const footerY = this.pageHeight - 20;
    
    this.addLine(footerY - 5);
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 126, 140);
    
    this.doc.text('Thank you for choosing Rejuvenators Mobile Massage', this.margin, footerY);
    this.doc.text('📧 info@rejuvenators.com | 📞 1300 302 542', this.margin, footerY + 5);
  }

  private addSectionHeader(title: string): void {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 126, 140);
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 8;
  }

  private addDetailRow(label: string, value: string): void {
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(label, this.margin, this.currentY);
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(value, this.margin + 40, this.currentY);
    
    this.currentY += 5;
  }

  private addLine(y?: number): void {
    const lineY = y || this.currentY;
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, lineY, this.pageWidth - this.margin, lineY);
    
    if (!y) {
      this.currentY += 5;
    }
  }

  private formatPaymentMethod(method: string): string {
    const methodMap: { [key: string]: string } = {
      'credit_card': 'Credit Card',
      'invoice': 'Invoice (Net 30)',
      'bank_transfer': 'Bank Transfer/EFT'
    };
    return methodMap[method] || method;
  }

  public downloadPDF(filename: string): void {
    this.doc.save(filename);
  }

  public getPDFBlob(): Blob {
    return this.doc.output('blob');
  }

  public getPDFBase64(): string {
    return this.doc.output('datauristring');
  }
}

// Export utility function
export const generateQuotePDF = (quoteData: QuoteData, filename?: string): void => {
  const generator = new QuotePDFGenerator();
  generator.generateQuotePDF(quoteData);
  
  const defaultFilename = `Quote-${quoteData.id.substring(0, 8).toUpperCase()}-${new Date().toLocaleDateString('en-AU').replace(/\//g, '-')}.pdf`;
  generator.downloadPDF(filename || defaultFilename);
};