const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role bypasses RLS

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('Configuration error: Missing Supabase service role credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create a client with anon key for token verification
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseAnon = supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/**
 * Verify user is authenticated with Supabase Auth
 * Verifies the Supabase Auth token and checks if user is an admin
 */
async function verifyAuth(authHeader) {
  if (!authHeader) {
    console.error('❌ Missing authorization header');
    throw new Error('Missing authorization header');
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.replace(/^Bearer\s+/i, '');
  
  if (!token) {
    console.error('❌ Missing token in authorization header');
    throw new Error('Missing token in authorization header');
  }

  console.log('🔍 Verifying token (length:', token.length, 'chars)');

  try {
    // Create a client with the anon key to verify the user token
    // We need the anon key (not service role) to properly verify user tokens
    const clientKey = supabaseAnonKey || supabaseKey;
    
    if (!clientKey) {
      console.error('❌ No Supabase key available for token verification');
      throw new Error('Server configuration error');
    }
    
    const tokenClient = createClient(supabaseUrl, clientKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Verify token by getting the user
    const { data: { user }, error: userError } = await tokenClient.auth.getUser();
    
    if (userError) {
      console.error('❌ Token verification error:', userError.message, userError.status);
      throw new Error('Invalid or expired token');
    }
    
    if (!user) {
      console.error('❌ No user found for token');
      throw new Error('Invalid or expired token');
    }

    console.log('✅ Token verified. User ID:', user.id, 'Email:', user.email);

    // Verify user is in admin_users table using service role client
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, email, role, is_active')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single();

    if (adminError) {
      console.error('❌ Admin user lookup error:', adminError.message, adminError.code);
      console.error('❌ Looking for auth_id:', user.id, 'Email:', user.email);
      throw new Error('User is not an admin');
    }

    if (!adminUser) {
      console.error('❌ Admin user not found for auth_id:', user.id);
      console.error('❌ User email:', user.email);
      throw new Error('User is not an admin');
    }

    console.log('🔍 Admin user found:', {
      email: adminUser.email,
      role: adminUser.role,
      is_active: adminUser.is_active,
      auth_id: user.id
    });

    // Check role is admin or super_admin
    if (adminUser.role !== 'admin' && adminUser.role !== 'super_admin') {
      console.error('❌ User does not have admin privileges.');
      console.error('❌ Email:', adminUser.email);
      console.error('❌ Current role:', adminUser.role);
      console.error('❌ Expected role: admin or super_admin');
      throw new Error(`User does not have admin privileges. Current role: ${adminUser.role}. Please contact support to update your role.`);
    }

    console.log('✅ Admin user verified:', adminUser.email, 'Role:', adminUser.role);
    return adminUser;
    
  } catch (error) {
    console.error('❌ Error in verifyAuth:', error.message);
    throw error;
  }
}

/**
 * Sync email changes from therapist_profiles to Supabase Auth and admin_users
 */
async function syncTherapistEmail(therapistId, newEmail) {
  try {
    console.log(`🔄 Syncing email change for therapist ${therapistId} to: ${newEmail}`);

    // Get therapist profile with auth_id and user_id
    const { data: therapist, error: fetchError } = await supabase
      .from('therapist_profiles')
      .select('auth_id, user_id, email')
      .eq('id', therapistId)
      .single();

    if (fetchError || !therapist) {
      console.error('❌ Failed to fetch therapist:', fetchError);
      throw new Error('Therapist not found');
    }

    const oldEmail = therapist.email;

    // Only sync if email actually changed
    if (oldEmail === newEmail) {
      console.log('✅ Email unchanged, no sync needed');
      return;
    }

    console.log(`📧 Email changing from ${oldEmail} to ${newEmail}`);

    // 1. Update Supabase Auth email with auto-confirmation
    if (therapist.auth_id) {
      console.log(`🔐 Updating Supabase Auth email for auth_id: ${therapist.auth_id}`);
      const { data: authUpdate, error: authError } = await supabase.auth.admin.updateUserById(
        therapist.auth_id,
        {
          email: newEmail,
          email_confirm: true // CRITICAL: Auto-confirm email to allow immediate login
        }
      );

      if (authError) {
        console.error('❌ Failed to update Supabase Auth email:', authError);
        throw new Error(`Failed to update Supabase Auth email: ${authError.message}`);
      }
      console.log('✅ Supabase Auth email updated and auto-confirmed');
    } else {
      console.warn('⚠️ No auth_id found - therapist will not be able to login');
    }

    // 2. Update admin_users email
    if (therapist.user_id) {
      console.log(`👤 Updating admin_users email for user_id: ${therapist.user_id}`);
      const { error: adminError } = await supabase
        .from('admin_users')
        .update({
          email: newEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', therapist.user_id);

      if (adminError) {
        console.error('❌ Failed to update admin_users email:', adminError);
        throw new Error(`Failed to update admin_users email: ${adminError.message}`);
      }
      console.log('✅ admin_users email updated');
    } else {
      console.warn('⚠️ No user_id found - admin_users not updated');
    }

    console.log('✅ Email sync complete - all three tables updated');
  } catch (error) {
    console.error('❌ Error syncing email:', error);
    // Throw the error to prevent partial updates
    throw new Error(`Email sync failed: ${error.message}`);
  }
}

/**
 * Build Supabase query based on request
 */
function buildQuery(operation, table, queryParams = {}) {
  let query = supabase.from(table);

  // Handle different operations
  switch (operation) {
    case 'select':
      query = query.select(queryParams.select || '*');
      break;
    case 'insert':
      query = query.insert(queryParams.data);
      if (queryParams.select) {
        query = query.select(queryParams.select);
      }
      break;
    case 'update':
      query = query.update(queryParams.data);
      if (queryParams.select) {
        query = query.select(queryParams.select);
      }
      break;
    case 'delete':
      query = query.delete();
      break;
    case 'upsert':
      query = query.upsert(queryParams.data);
      if (queryParams.select) {
        query = query.select(queryParams.select);
      }
      break;
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }

  // Apply filters
  if (queryParams.eq) {
    for (const [column, value] of Object.entries(queryParams.eq)) {
      query = query.eq(column, value);
    }
  }

  if (queryParams.neq) {
    for (const [column, value] of Object.entries(queryParams.neq)) {
      query = query.neq(column, value);
    }
  }

  if (queryParams.gt) {
    for (const [column, value] of Object.entries(queryParams.gt)) {
      query = query.gt(column, value);
    }
  }

  if (queryParams.gte) {
    for (const [column, value] of Object.entries(queryParams.gte)) {
      query = query.gte(column, value);
    }
  }

  if (queryParams.lt) {
    for (const [column, value] of Object.entries(queryParams.lt)) {
      query = query.lt(column, value);
    }
  }

  if (queryParams.lte) {
    for (const [column, value] of Object.entries(queryParams.lte)) {
      query = query.lte(column, value);
    }
  }

  if (queryParams.like) {
    for (const [column, value] of Object.entries(queryParams.like)) {
      query = query.like(column, value);
    }
  }

  if (queryParams.ilike) {
    for (const [column, value] of Object.entries(queryParams.ilike)) {
      query = query.ilike(column, value);
    }
  }

  if (queryParams.is) {
    for (const [column, value] of Object.entries(queryParams.is)) {
      query = query.is(column, value);
    }
  }

  if (queryParams.in) {
    for (const [column, value] of Object.entries(queryParams.in)) {
      query = query.in(column, value);
    }
  }

  if (queryParams.contains) {
    for (const [column, value] of Object.entries(queryParams.contains)) {
      query = query.contains(column, value);
    }
  }

  // Apply OR filter
  if (queryParams.or) {
    query = query.or(queryParams.or);
  }

  // Apply NOT filters
  if (queryParams.not && Array.isArray(queryParams.not)) {
    for (const notFilter of queryParams.not) {
      query = query.not(notFilter.column, notFilter.operator, notFilter.value);
    }
  }

  // Apply ordering
  if (queryParams.order) {
    for (const orderClause of queryParams.order) {
      query = query.order(orderClause.column, { ascending: orderClause.ascending !== false });
    }
  }

  // Apply limit
  if (queryParams.limit) {
    query = query.limit(queryParams.limit);
  }

  // Apply range
  if (queryParams.range) {
    query = query.range(queryParams.range.from, queryParams.range.to);
  }

  // Apply single/maybeSingle only for operations that should return a single row
  if (queryParams.single) {
    // For INSERT/UPSERT: always apply .single() (they create one row)
    // For UPDATE/DELETE: only apply if there's an eq filter (targeting specific row)
    // For SELECT: only apply if there's an eq filter (querying specific row)
    if (operation === 'insert' || operation === 'upsert') {
      query = query.single();
    } else if (queryParams.eq && Object.keys(queryParams.eq).length > 0) {
      // Only apply .single() if there's actually an eq filter
      query = query.single();
    }
  }

  // Apply maybeSingle
  if (queryParams.maybeSingle) {
    query = query.maybeSingle();
  }

  return query;
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Verify Supabase Auth token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    
    try {
      user = await verifyAuth(authHeader);
    } catch (error) {
      console.error('❌ Token verification failed:', error.message);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: error.message })
      };
    }

    // Parse request body
    const { operation, table, query: queryParams } = JSON.parse(event.body);

    if (!operation || !table) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing operation or table' })
      };
    }

    console.log(`🔍 Admin data request: ${operation} on ${table} by ${user.email}`);

    // Special handling: Sync email changes for therapist_profiles
    if (operation === 'update' && table === 'therapist_profiles' && queryParams.data?.email) {
      // Get therapist ID from eq filter
      const therapistId = queryParams.eq?.id;
      if (therapistId) {
        await syncTherapistEmail(therapistId, queryParams.data.email);
      }
    }

    // Build and execute query
    const query = buildQuery(operation, table, queryParams);
    const result = await query;

    if (result.error) {
      console.error('❌ Query error:', result.error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: result.error.message, details: result.error })
      };
    }

    // Log the operation (for audit trail)
    try {
      await supabase
        .from('admin_activity_log')
        .insert({
          user_id: user.userId,
          action: `${operation}_${table}`,
          table_name: table,
          record_id: queryParams?.eq?.id || queryParams?.data?.id || null,
          new_values: queryParams?.data || null,
          ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip']
        });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
      // Don't fail the request if logging fails
    }

    console.log(`✅ Query successful: ${result.data?.length || 0} rows affected`);

    // Return result in same format as Supabase client
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result.data,
        count: result.count,
        status: result.status,
        statusText: result.statusText
      })
    };

  } catch (error) {
    console.error('❌ Admin data error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error', message: error.message })
    };
  }
};

