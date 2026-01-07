// One-time script to fix existing users without Supabase Auth credentials
// Run this with: node database/migrations/fix-existing-users.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dcukfurezlkagvvwgsgr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.log('Set it with: $env:SUPABASE_SERVICE_ROLE_KEY="your-key-here"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DEFAULT_PASSWORD = 'Test100!';

async function fixExistingUsers() {
  try {
    console.log('🔧 Starting fix for existing users without auth_id...\n');

    // Get all admin_users without auth_id
    const { data: usersWithoutAuth, error: fetchError } = await supabase
      .from('admin_users')
      .select('id, email, first_name, last_name, role')
      .is('auth_id', null);

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    if (!usersWithoutAuth || usersWithoutAuth.length === 0) {
      console.log('✅ No users found without auth_id. All users are fixed!');
      return;
    }

    console.log(`📋 Found ${usersWithoutAuth.length} users without auth_id:\n`);
    usersWithoutAuth.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role})`);
    });
    console.log(`\n🔑 Default password for all: ${DEFAULT_PASSWORD}\n`);

    let successCount = 0;
    let failCount = 0;

    for (const user of usersWithoutAuth) {
      try {
        console.log(`\n🔧 Fixing user: ${user.email}`);

        // Create Supabase Auth user
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

        console.log(`   ✅ Created auth user: ${authData.user.id}`);

        // Update admin_users with auth_id
        const { error: updateError } = await supabase
          .from('admin_users')
          .update({
            auth_id: authData.user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          // Rollback: delete the auth user
          await supabase.auth.admin.deleteUser(authData.user.id);
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log(`   ✅ Updated admin_users with auth_id`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Fix complete!`);
    console.log(`   - Successful: ${successCount}`);
    console.log(`   - Failed: ${failCount}`);
    console.log(`   - Default password: ${DEFAULT_PASSWORD}`);
    console.log(`${'='.repeat(60)}\n`);

    if (successCount > 0) {
      console.log('📧 Notify users to login with:');
      console.log(`   Email: [their email]`);
      console.log(`   Password: ${DEFAULT_PASSWORD}`);
      console.log(`   They can change their password after first login.\n`);
    }

  } catch (error) {
    console.error('❌ Fix users error:', error);
    process.exit(1);
  }
}

fixExistingUsers();
