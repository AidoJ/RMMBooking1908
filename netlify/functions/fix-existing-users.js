const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_PASSWORD = 'Test100!';

exports.handler = async (event, context) => {
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
    // Verify super admin authentication
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing authorization token' })
      };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid token' })
      };
    }

    // Verify super admin role
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('role')
      .eq('auth_id', authUser.id)
      .eq('is_active', true)
      .single();

    if (adminError || !adminUser || adminUser.role !== 'super_admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Super admin access required' })
      };
    }

    console.log('🔧 Starting fix for users without Supabase Auth credentials...');

    // Get all admin_users without auth_id (these exist in DB but not in Supabase Auth)
    const { data: usersWithoutAuth, error: fetchError } = await supabase
      .from('admin_users')
      .select('id, email, first_name, last_name, role')
      .is('auth_id', null);

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    if (!usersWithoutAuth || usersWithoutAuth.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No users found without auth credentials. All users are already fixed!',
          fixed: 0,
          defaultPassword: null
        })
      };
    }

    console.log(`📋 Found ${usersWithoutAuth.length} users in admin_users without Supabase Auth`);

    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const user of usersWithoutAuth) {
      try {
        console.log(`🔧 Creating Supabase Auth for: ${user.email}`);

        // Create Supabase Auth user (this is what's missing!)
        const { data: authData, error: createError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
          }
        });

        if (createError) {
          throw new Error(`Auth creation failed: ${createError.message}`);
        }

        console.log(`✅ Created Supabase Auth user: ${authData.user.id}`);

        // Link the Supabase Auth user to the admin_users record
        const { error: updateError } = await supabase
          .from('admin_users')
          .update({
            auth_id: authData.user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          // Rollback: delete the auth user we just created
          await supabase.auth.admin.deleteUser(authData.user.id);
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        results.push({
          email: user.email,
          role: user.role,
          status: 'success',
          auth_id: authData.user.id
        });

        successCount++;
        console.log(`✅ Successfully linked ${user.email} to Supabase Auth`);

      } catch (error) {
        console.error(`❌ Failed to fix ${user.email}:`, error);
        results.push({
          email: user.email,
          role: user.role,
          status: 'failed',
          error: error.message
        });
        failCount++;
      }
    }

    console.log(`✅ Fix complete: ${successCount} successful, ${failCount} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Fixed ${successCount} of ${usersWithoutAuth.length} users`,
        defaultPassword: DEFAULT_PASSWORD,
        successCount,
        failCount,
        totalUsers: usersWithoutAuth.length,
        results
      })
    };

  } catch (error) {
    console.error('❌ Fix users error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
