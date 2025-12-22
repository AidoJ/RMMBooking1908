/**
 * SUPABASE AUTH USER MIGRATION SCRIPT
 *
 * This script migrates existing users from custom auth to Supabase Auth
 *
 * BEFORE RUNNING:
 * 1. npm install @supabase/supabase-js
 * 2. Set environment variables:
 *    - VITE_SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY (from Supabase Dashboard > Settings > API)
 *
 * RUN:
 * node migrate-users-to-auth.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load from environment or .env file
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrateUsers() {
  console.log('🚀 Starting Supabase Auth migration...\n');

  try {
    // Step 1: Get all admin users
    console.log('📋 Step 1: Fetching admin users...');
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('id, email, role')
      .is('auth_id', null);

    if (adminError) throw adminError;
    console.log(`   Found ${adminUsers?.length || 0} admin users to migrate\n`);

    // Step 2: Get all therapist profiles
    console.log('📋 Step 2: Fetching therapist profiles...');
    const { data: therapists, error: therapistError } = await supabase
      .from('therapist_profiles')
      .select('id, email, first_name, last_name')
      .is('auth_id', null);

    if (therapistError) throw therapistError;
    console.log(`   Found ${therapists?.length || 0} therapist profiles to migrate\n`);

    // Step 3: Create auth users for admins
    console.log('👤 Step 3: Creating Supabase Auth users for admins...');
    for (const admin of adminUsers || []) {
      try {
        // Create auth user with temp password
        const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
          email: admin.email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            role: admin.role
          }
        });

        if (createError) {
          console.error(`   ❌ Failed to create auth user for ${admin.email}:`, createError.message);
          continue;
        }

        // Link to admin_users record
        const { error: updateError } = await supabase
          .from('admin_users')
          .update({ auth_id: authUser.user.id })
          .eq('id', admin.id);

        if (updateError) {
          console.error(`   ❌ Failed to link admin ${admin.email}:`, updateError.message);
          continue;
        }

        console.log(`   ✅ Created and linked: ${admin.email}`);
        console.log(`      Temp password: ${tempPassword}`);
      } catch (err) {
        console.error(`   ❌ Error processing admin ${admin.email}:`, err.message);
      }
    }
    console.log();

    // Step 4: Create auth users for therapists
    console.log('👤 Step 4: Creating Supabase Auth users for therapists...');
    for (const therapist of therapists || []) {
      try {
        // Create auth user with temp password
        const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
          email: therapist.email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            role: 'therapist',
            first_name: therapist.first_name,
            last_name: therapist.last_name
          }
        });

        if (createError) {
          console.error(`   ❌ Failed to create auth user for ${therapist.email}:`, createError.message);
          continue;
        }

        // Link to therapist_profiles record
        const { error: updateError } = await supabase
          .from('therapist_profiles')
          .update({ auth_id: authUser.user.id })
          .eq('id', therapist.id);

        if (updateError) {
          console.error(`   ❌ Failed to link therapist ${therapist.email}:`, updateError.message);
          continue;
        }

        console.log(`   ✅ Created and linked: ${therapist.email} (${therapist.first_name} ${therapist.last_name})`);
        console.log(`      Temp password: ${tempPassword}`);
      } catch (err) {
        console.error(`   ❌ Error processing therapist ${therapist.email}:`, err.message);
      }
    }
    console.log();

    // Step 5: Verify migration
    console.log('✅ Step 5: Verifying migration...');

    const { data: linkedAdmins } = await supabase
      .from('admin_users')
      .select('email, auth_id')
      .not('auth_id', 'is', null);

    const { data: linkedTherapists } = await supabase
      .from('therapist_profiles')
      .select('email, auth_id, first_name, last_name')
      .not('auth_id', 'is', null);

    console.log(`   ${linkedAdmins?.length || 0} admin users linked`);
    console.log(`   ${linkedTherapists?.length || 0} therapist profiles linked\n`);

    console.log('🎉 Migration complete!\n');
    console.log('⚠️  IMPORTANT NEXT STEPS:');
    console.log('   1. Save the temporary passwords shown above');
    console.log('   2. Send password reset links to all users');
    console.log('   3. Test login with Supabase Auth');
    console.log('   4. Update frontend code to use Supabase Auth SDK\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateUsers();
