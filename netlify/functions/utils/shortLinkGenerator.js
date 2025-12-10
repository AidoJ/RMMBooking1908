/**
 * Short Link Generator Utility
 *
 * Generates short codes and stores them in the database
 * Used by various Netlify functions to create shortened URLs
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Generate a random short code
 * Uses base62 encoding (a-z, A-Z, 0-9) for URL-safe codes
 */
function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a short link in the database
 *
 * @param {string} originalUrl - The full URL to shorten
 * @param {object} options - Optional settings
 * @param {number} options.expiresInDays - Days until link expires (default: 30)
 * @param {object} options.metadata - Additional metadata to store
 * @returns {Promise<{shortCode: string, shortUrl: string}>}
 */
async function createShortLink(originalUrl, options = {}) {
  const {
    expiresInDays = 30,
    metadata = {}
  } = options;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Try to generate a unique short code (max 5 attempts)
  let shortCode;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    shortCode = generateShortCode(6);

    // Check if code already exists
    const { data: existing } = await supabase
      .from('short_links')
      .select('id')
      .eq('short_code', shortCode)
      .single();

    if (!existing) {
      // Code is unique, break the loop
      break;
    }

    attempts++;
    console.log(`⚠️ Short code collision, retrying... (${attempts}/${maxAttempts})`);
  }

  if (attempts === maxAttempts) {
    throw new Error('Failed to generate unique short code after multiple attempts');
  }

  // Insert into database
  const { data, error } = await supabase
    .from('short_links')
    .insert({
      short_code: shortCode,
      original_url: originalUrl,
      expires_at: expiresAt.toISOString(),
      metadata: metadata,
      click_count: 0
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating short link:', error);
    throw error;
  }

  const baseUrl = 'https://booking.rejuvenators.com/s';
  const shortUrl = `${baseUrl}/${shortCode}`;

  console.log('✅ Created short link:', { shortCode, shortUrl, originalUrl });

  return {
    shortCode,
    shortUrl,
    expiresAt: expiresAt.toISOString()
  };
}

/**
 * Create multiple short links in batch
 *
 * @param {Array<{url: string, metadata?: object}>} urls - Array of URLs to shorten
 * @param {object} options - Optional settings
 * @returns {Promise<Array<{shortCode: string, shortUrl: string, originalUrl: string}>>}
 */
async function createBatchShortLinks(urls, options = {}) {
  const results = [];

  for (const urlConfig of urls) {
    const { url, metadata = {} } = urlConfig;
    const result = await createShortLink(url, { ...options, metadata });
    results.push({
      ...result,
      originalUrl: url
    });
  }

  return results;
}

module.exports = {
  generateShortCode,
  createShortLink,
  createBatchShortLinks
};
