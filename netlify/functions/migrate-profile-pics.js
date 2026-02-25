/**
 * One-time migration: Convert base64 profile_pic blobs in therapist_profiles
 * to Supabase Storage URLs.
 *
 * Run once via GET request:
 *   /.netlify/functions/migrate-profile-pics
 *
 * Safe to re-run — it skips rows that already have a URL (not base64).
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  // Simple auth guard — require a query param so it can't be triggered accidentally
  const params = event.queryStringParameters || {};
  if (params.key !== process.env.MIGRATION_SECRET && params.key !== 'run-migrate-now') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Provide ?key=run-migrate-now' }),
    };
  }

  try {
    // Fetch all therapist profiles that have a profile_pic
    const { data: therapists, error: fetchError } = await supabase
      .from('therapist_profiles')
      .select('id, first_name, last_name, profile_pic')
      .not('profile_pic', 'is', null)
      .neq('profile_pic', '');

    if (fetchError) throw fetchError;

    const results = { migrated: 0, skipped: 0, failed: 0, details: [] };

    for (const therapist of therapists || []) {
      const pic = therapist.profile_pic;

      // Skip if already a URL (not base64)
      if (pic && (pic.startsWith('http://') || pic.startsWith('https://'))) {
        results.skipped++;
        results.details.push({ id: therapist.id, name: `${therapist.first_name} ${therapist.last_name}`, status: 'skipped (already URL)' });
        continue;
      }

      // Skip if not a base64 data URI
      if (!pic || !pic.startsWith('data:')) {
        results.skipped++;
        results.details.push({ id: therapist.id, name: `${therapist.first_name} ${therapist.last_name}`, status: 'skipped (not base64)' });
        continue;
      }

      try {
        // Parse base64 data URI: data:image/jpeg;base64,/9j/4AAQ...
        const matches = pic.match(/^data:(.+?);base64,(.+)$/);
        if (!matches) {
          results.skipped++;
          results.details.push({ id: therapist.id, name: `${therapist.first_name} ${therapist.last_name}`, status: 'skipped (invalid base64 format)' });
          continue;
        }

        const contentType = matches[1]; // e.g. image/jpeg
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Determine file extension from content type
        const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
        const ext = extMap[contentType] || 'jpg';

        const fileName = `profile-photos/${therapist.id}-${Date.now()}.${ext}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('therapist-documents')
          .upload(fileName, buffer, {
            contentType,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('therapist-documents')
          .getPublicUrl(fileName);

        // Update the row with the URL
        const { error: updateError } = await supabase
          .from('therapist_profiles')
          .update({ profile_pic: publicUrl })
          .eq('id', therapist.id);

        if (updateError) throw updateError;

        results.migrated++;
        results.details.push({ id: therapist.id, name: `${therapist.first_name} ${therapist.last_name}`, status: 'migrated', url: publicUrl });
        console.log(`✅ Migrated ${therapist.first_name} ${therapist.last_name} → ${publicUrl}`);

      } catch (err) {
        results.failed++;
        results.details.push({ id: therapist.id, name: `${therapist.first_name} ${therapist.last_name}`, status: 'failed', error: err.message });
        console.error(`❌ Failed ${therapist.first_name} ${therapist.last_name}:`, err.message);
      }
    }

    console.log(`\n📊 Migration complete: ${results.migrated} migrated, ${results.skipped} skipped, ${results.failed} failed`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results, null, 2),
    };

  } catch (error) {
    console.error('❌ Migration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
