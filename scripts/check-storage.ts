// Quick manual check of the attachments bucket: it is private, a signed link works and expires logic is in place.
// Usage: npx tsx scripts/check-storage.ts
import { loadEnv } from "./_env";

loadEnv();

async function main() {
  const { createAdminSupabase } = await import("../src/lib/supabase/admin");
  const { ATTACHMENT_BUCKET, SIGNED_URL_SECONDS } = await import("../src/lib/attachments");
  const s = createAdminSupabase();
  const bucket = await s.storage.getBucket(ATTACHMENT_BUCKET);
  console.log("bucket public:", bucket.data?.public);
  const path = `_check/${Date.now()}-hello.txt`;
  const up = await s.storage.from(ATTACHMENT_BUCKET).upload(path, new TextEncoder().encode("hello"), { contentType: "text/plain" });
  console.log("upload error:", up.error?.message ?? "none");
  const pub = s.storage.from(ATTACHMENT_BUCKET).getPublicUrl(path).data.publicUrl;
  console.log("public URL status (should not be 200):", (await fetch(pub)).status);
  const signed = await s.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS, { download: "hello.txt" });
  const res = await fetch(signed.data!.signedUrl);
  console.log("signed URL status:", res.status, "body:", await res.text());
  await s.storage.from(ATTACHMENT_BUCKET).remove([path]);
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
