interface QuoteData {
  id: string;
}

export const generateQuotePDF = async (quoteData: QuoteData): Promise<void> => {
  try {
    const response = await fetch('/.netlify/functions/generate-quote-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bookingId: quoteData.id
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate PDF');
    }

    const result = await response.json();
    
    // Convert base64 to blob and trigger download
    const pdfBlob = base64ToBlob(result.pdf, 'application/pdf');
    const url = URL.createObjectURL(pdfBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}