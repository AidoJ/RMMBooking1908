const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const key = event.queryStringParameters?.key;

    if (!key) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing key parameter' })
      };
    }

    const { data: setting, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', key)
      .single();

    if (error || !setting) {
      console.error('❌ Setting not found:', key);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Setting not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(setting)
    };

  } catch (error) {
    console.error('❌ Error fetching setting:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
