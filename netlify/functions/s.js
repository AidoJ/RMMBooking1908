/**
 * Short Link Redirect Handler
 *
 * Handles redirect from short URLs (e.g., /s/abc123) to original URLs
 * Tracks click counts for analytics
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Extract short code from query parameter (via Netlify redirect)
  const shortCode = event.queryStringParameters?.code;

  console.log('🔗 Short link redirect request for:', shortCode);

  if (!shortCode) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invalid Link</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 2rem;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 400px;
              }
              h1 { color: #e53e3e; margin: 0 0 1rem 0; }
              p { color: #4a5568; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Invalid Link</h1>
              <p>No short code provided.</p>
            </div>
          </body>
        </html>
      `
    };
  }

  try {
    // Look up the short link
    const { data: shortLink, error } = await supabase
      .from('short_links')
      .select('*')
      .eq('short_code', shortCode)
      .single();

    if (error || !shortLink) {
      console.error('❌ Short link not found:', shortCode);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Link Not Found</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                  background: white;
                  padding: 2rem;
                  border-radius: 12px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                  text-align: center;
                  max-width: 400px;
                }
                h1 { color: #e53e3e; margin: 0 0 1rem 0; }
                p { color: #4a5568; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>🔍 Link Not Found</h1>
                <p>This link does not exist or has expired.</p>
                <p style="font-size: 0.875rem; color: #a0aec0;">Code: ${shortCode}</p>
              </div>
            </body>
          </html>
        `
      };
    }

    // Check if expired
    if (shortLink.expires_at && new Date(shortLink.expires_at) < new Date()) {
      console.log('⏰ Short link expired:', shortCode);
      return {
        statusCode: 410,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Link Expired</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                  background: white;
                  padding: 2rem;
                  border-radius: 12px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                  text-align: center;
                  max-width: 400px;
                }
                h1 { color: #ed8936; margin: 0 0 1rem 0; }
                p { color: #4a5568; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>⏰ Link Expired</h1>
                <p>This link has expired and is no longer valid.</p>
              </div>
            </body>
          </html>
        `
      };
    }

    // Increment click count (fire and forget - don't wait)
    supabase
      .from('short_links')
      .update({ click_count: shortLink.click_count + 1 })
      .eq('id', shortLink.id)
      .then(() => console.log('✅ Click count updated for:', shortCode))
      .catch(err => console.error('❌ Error updating click count:', err));

    // Redirect to original URL
    console.log('✅ Redirecting to:', shortLink.original_url);
    return {
      statusCode: 302,
      headers: {
        'Location': shortLink.original_url,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };

  } catch (error) {
    console.error('❌ Error processing short link:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 2rem;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 400px;
              }
              h1 { color: #e53e3e; margin: 0 0 1rem 0; }
              p { color: #4a5568; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>⚠️ Error</h1>
              <p>An error occurred processing this link.</p>
            </div>
          </body>
        </html>
      `
    };
  }
};
