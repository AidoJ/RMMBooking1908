// Generate bcrypt hash for a password
// Run this with: node generate-password-hash.js

const bcrypt = require('bcryptjs');

// Set the password you want to hash
const password = 'TempAdmin2025!';

// Generate hash with salt rounds = 10 (same as used in admin-auth.js)
bcrypt.genSalt(10, (err, salt) => {
  if (err) {
    console.error('Error generating salt:', err);
    return;
  }

  bcrypt.hash(password, salt, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err);
      return;
    }

    console.log('\n=================================');
    console.log('Password:', password);
    console.log('Hash:', hash);
    console.log('=================================\n');
    console.log('Run this SQL in Supabase:\n');
    console.log(`UPDATE admin_users`);
    console.log(`SET password = '${hash}'`);
    console.log(`WHERE email = 'aidan@rejuvenators.com';`);
    console.log('\n=================================\n');
  });
});
