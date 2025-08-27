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
      throw new Error(error.error || 'Failed to generate quote');
    }

    const result = await response.json();
    
    // Open the HTML content in a new tab for printing/saving as PDF
    const newWindow = window.open('', '_blank');
    
    if (newWindow) {
      newWindow.document.write(result.html);
      newWindow.document.close();
      
      // Focus the new window
      newWindow.focus();
    } else {
      // Fallback: Create a blob URL and open it
      const htmlBlob = new Blob([result.html], { type: 'text/html' });
      const url = URL.createObjectURL(htmlBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    
  } catch (error) {
    console.error('Error generating quote:', error);
    throw error;
  }
};