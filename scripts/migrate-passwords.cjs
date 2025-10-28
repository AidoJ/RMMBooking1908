/**
 * One-time migration script to hash existing plain-text passwords
 *
 * This script:
 * 1. Reads all users from admin_users table
 * 2. Hashes their plain-text passwords using bcrypt
 * 3. Updates the database with hashed passwords
 *
 * Run this ONCE before deploying the new auth system.
 *
 * Usage:
 *   node scripts/migrate-passwords.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure you have a .env file with these variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migratePasswords() {
  try {
    console.log('🔐 Starting password migration...\n');

    // Get all users
    const { data: users, error } = await supabase
      .from('admin_users')
      .select('id, email, password')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    if (!users || users.length === 0) {
      console.log('No users found to migrate.');
      return;
    }

    console.log(`Found ${users.length} users to migrate:\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
        if (user.password && /^\$2[aby]\$\d+\$/.test(user.password)) {
          console.log(`⏭️  Skipping ${user.email} - password already hashed`);
          skippedCount++;
          continue;
        }

        // Hash the plain-text password
        const hashedPassword = await bcrypt.hash(user.password, 10);

        // Update the database
        const { error: updateError } = await supabase
          .from('admin_users')
          .update({
            password: hashedPassword,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`✅ Migrated ${user.email}`);
        migratedCount++;

      } catch (userError) {
        console.error(`❌ Error migrating ${user.email}:`, userError.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already hashed): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${users.length}`);
    console.log('='.repeat(50));

    if (migratedCount > 0) {
      console.log('\n🎉 Password migration completed successfully!');
      console.log('\n⚠️  IMPORTANT: Make sure to deploy the updated auth functions now.');
      console.log('The auth functions now expect bcrypt-hashed passwords.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Confirm before running
console.log('⚠️  WARNING: This script will hash all plain-text passwords in admin_users table.');
console.log('This operation cannot be undone!\n');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  migratePasswords().then(() => {
    process.exit(0);
  });
}, 3000);
