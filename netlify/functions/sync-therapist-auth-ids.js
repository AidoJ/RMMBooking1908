const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log('🔧 Syncing auth_id from admin_users to therapist_profiles...');

    // Get all therapist_profiles with null auth_id
    const { data: profilesWithoutAuth, error: fetchError } = await supabase
      .from('therapist_profiles')
      .select('id, user_id, email, first_name, last_name')
      .is('auth_id', null);

    if (fetchError) {
      throw new Error(`Failed to fetch therapist profiles: ${fetchError.message}`);
    }

    if (!profilesWithoutAuth || profilesWithoutAuth.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'All therapist profiles already have auth_id set!',
          synced: 0
        })
      };
    }

    console.log(`📋 Found ${profilesWithoutAuth.length} therapist profiles without auth_id`);

    let syncedCount = 0;
    let failCount = 0;
    const results = [];

    for (const profile of profilesWithoutAuth) {
      try {
        console.log(`🔧 Syncing auth_id for: ${profile.email}`);

        // Get auth_id from admin_users using user_id
        const { data: adminUserRecord, error: adminUserError } = await supabase
          .from('admin_users')
          .select('auth_id, email')
          .eq('id', profile.user_id)
          .single();

        if (adminUserError || !adminUserRecord) {
          throw new Error(`No admin_users record found for user_id: ${profile.user_id}`);
        }

        if (!adminUserRecord.auth_id) {
          throw new Error(`admin_users record has no auth_id (user needs auth fix first)`);
        }

        console.log(`   Found auth_id: ${adminUserRecord.auth_id}`);

        // Update therapist_profiles with auth_id
        const { error: updateError } = await supabase
          .from('therapist_profiles')
          .update({
            auth_id: adminUserRecord.auth_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id);

        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }

        console.log(`✅ Synced auth_id for ${profile.email}`);

        results.push({
          email: profile.email,
          status: 'synced',
          auth_id: adminUserRecord.auth_id
        });

        syncedCount++;

      } catch (error) {
        console.error(`❌ Failed to sync ${profile.email}:`, error);
        results.push({
          email: profile.email,
          status: 'failed',
          error: error.message
        });
        failCount++;
      }
    }

    console.log(`✅ Sync complete: ${syncedCount} synced, ${failCount} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Synced ${syncedCount} of ${profilesWithoutAuth.length} therapist profiles`,
        syncedCount,
        failCount,
        totalProfiles: profilesWithoutAuth.length,
        results
      })
    };

  } catch (error) {
    console.error('❌ Sync auth IDs error:', error);
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
