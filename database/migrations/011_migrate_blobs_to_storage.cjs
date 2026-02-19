/**
 * Migration: Move base64 blobs from therapist_payments to Supabase Storage
 *
 * This script:
 * 1. Finds all rows where therapist_invoice_url or parking_receipt_url contains base64 data
 * 2. Uploads each file to the 'therapist-documents' storage bucket
 * 3. Updates the DB row to store only the storage path
 *
 * Run with: node database/migrations/011_migrate_blobs_to_storage.js
 *
 * Requires environment variables:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Or set them inline before running:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node database/migrations/011_migrate_blobs_to_storage.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Auto-load .env from project root (try both __dirname-relative and cwd)
let envPath = path.resolve(__dirname, '..', '..', '.env');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve(process.cwd(), '.env');
}
console.log('Loading .env from:', envPath, 'exists:', fs.existsSync(envPath));
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    line = line.replace(/\r$/, ''); // strip Windows carriage return
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const STORAGE_BUCKET = 'therapist-documents';

async function uploadBase64ToStorage(base64DataUrl, folder, filename) {
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    console.error(`  Invalid base64 format for ${filename}`);
    return null;
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  const extMap = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'application/pdf': 'pdf',
  };
  const ext = extMap[mimeType] || 'bin';
  const storagePath = `${folder}/${filename}.${ext}`;

  console.log(`  Uploading: ${storagePath} (${(buffer.length / 1024).toFixed(1)} KB, ${mimeType})`);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error(`  Upload error: ${error.message}`);
    return null;
  }

  return storagePath;
}

async function migrate() {
  console.log('=== Blob to Storage Migration ===');
  console.log(`Bucket: ${STORAGE_BUCKET}`);
  console.log('');

  // Fetch all rows - only the columns we need (id, therapist_id, week_end_date, and the blob columns)
  const { data: rows, error } = await supabase
    .from('therapist_payments')
    .select('id, therapist_id, week_end_date, therapist_invoice_url, parking_receipt_url')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching rows:', error.message);
    process.exit(1);
  }

  console.log(`Found ${rows.length} total rows in therapist_payments`);

  // Filter to rows that have base64 data
  const blobRows = rows.filter(row =>
    (row.therapist_invoice_url && row.therapist_invoice_url.startsWith('data:')) ||
    (row.parking_receipt_url && row.parking_receipt_url.startsWith('data:'))
  );

  console.log(`Found ${blobRows.length} rows with base64 blob data to migrate`);
  console.log('');

  if (blobRows.length === 0) {
    console.log('Nothing to migrate. All done!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const row of blobRows) {
    console.log(`Processing row ${row.id} (therapist: ${row.therapist_id}, week ending: ${row.week_end_date})`);

    const updates = {};
    const weekEnd = row.week_end_date || 'unknown';
    const timestamp = Date.now();

    // Migrate invoice
    if (row.therapist_invoice_url && row.therapist_invoice_url.startsWith('data:')) {
      const path = await uploadBase64ToStorage(
        row.therapist_invoice_url,
        `invoices/${row.therapist_id}`,
        `invoice_${weekEnd}_${timestamp}`
      );
      if (path) {
        updates.therapist_invoice_url = path;
        console.log(`  Invoice migrated -> ${path}`);
      } else {
        console.error(`  FAILED to migrate invoice for row ${row.id}`);
        errorCount++;
        continue; // Skip this row entirely if upload fails
      }
    }

    // Migrate parking receipt
    if (row.parking_receipt_url && row.parking_receipt_url.startsWith('data:')) {
      const path = await uploadBase64ToStorage(
        row.parking_receipt_url,
        `receipts/${row.therapist_id}`,
        `receipt_${weekEnd}_${timestamp}`
      );
      if (path) {
        updates.parking_receipt_url = path;
        console.log(`  Receipt migrated -> ${path}`);
      } else {
        console.error(`  FAILED to migrate receipt for row ${row.id}`);
        errorCount++;
        continue;
      }
    }

    // Update the DB row with storage paths
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('therapist_payments')
        .update(updates)
        .eq('id', row.id);

      if (updateError) {
        console.error(`  DB update error: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`  DB updated successfully`);
        successCount++;
      }
    }

    console.log('');
  }

  console.log('=== Migration Complete ===');
  console.log(`Migrated: ${successCount} rows`);
  console.log(`Errors: ${errorCount} rows`);

  if (errorCount > 0) {
    console.log('\nSome rows failed. Re-run the script to retry failed rows.');
    console.log('(Already-migrated rows will be skipped since they no longer start with "data:")');
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
