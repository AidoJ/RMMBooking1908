const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('📋 Fetching active agreement template...');

    // Call the database function to get active agreement
    const { data, error } = await supabase
      .rpc('get_active_agreement_template');

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No active agreement template found');
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: 'No active agreement template found'
        }),
      };
    }

    const agreement = data[0];

    console.log(`✅ Found agreement: ${agreement.version} - ${agreement.title}`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        agreement: {
          id: agreement.id,
          version: agreement.version,
          title: agreement.title,
          content_html: agreement.content_html,
          content_pdf_url: agreement.content_pdf_url,
          summary_points: agreement.summary_points
        }
      }),
    };

  } catch (error) {
    console.error('❌ Error fetching agreement:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to fetch agreement template'
      }),
    };
  }
};
