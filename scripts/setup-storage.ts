// Creates the private Supabase Storage bucket for attachments (safe to run again).
// Run by `npm run db:setup` and on its own with `npm run storage:setup`.
import { loadEnv } from "./_env";

loadEnv();

export async function ensureAttachmentsBucket(): Promise<void> {
  const { createAdminSupabase } = await import("../src/lib/supabase/admin");
  const { ATTACHMENT_BUCKET, MAX_ATTACHMENT_BYTES, ALLOWED_TYPES } = await import("../src/lib/attachments");
  const supabase = createAdminSupabase();
  const options = {
    public: false, // the browser can never read it directly; downloads use short-lived signed links
    fileSizeLimit: MAX_ATTACHMENT_BYTES,
    allowedMimeTypes: Array.from(new Set(Object.values(ALLOWED_TYPES).map((t) => t.mime))),
  };
  const { data: existing } = await supabase.storage.getBucket(ATTACHMENT_BUCKET);
  if (existing) {
    const { error } = await supabase.storage.updateBucket(ATTACHMENT_BUCKET, options);
    if (error) throw new Error(`Could not update bucket: ${error.message}`);
    console.log(`Storage bucket '${ATTACHMENT_BUCKET}' already exists (private); settings refreshed.`);
    return;
  }
  const { error } = await supabase.storage.createBucket(ATTACHMENT_BUCKET, options);
  if (error) throw new Error(`Could not create bucket: ${error.message}`);
  console.log(`Created private storage bucket '${ATTACHMENT_BUCKET}'.`);
}

if (require.main === module) {
  ensureAttachmentsBucket().catch((e) => {
    console.error("storage setup failed:", String(e.message ?? e));
    process.exit(1);
  });
}
