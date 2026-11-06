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
  // Signed upload link, used with the publishable key like the browser does (what Vercel needs for big files).
  const { createClient } = await import("@supabase/supabase-js");
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const path2 = `_check/${Date.now()}-signed.txt`;
  const tok = await s.storage.from(ATTACHMENT_BUCKET).createSignedUploadUrl(path2);
  const up2 = await anon.storage.from(ATTACHMENT_BUCKET).uploadToSignedUrl(path2, tok.data!.token, new Blob(["signed"], { type: "text/plain" }));
  console.log("signed upload error:", up2.error?.message ?? "none");
  const direct = await anon.storage.from(ATTACHMENT_BUCKET).upload(`_check/${Date.now()}-nope.txt`, new Blob(["x"]));
  console.log("direct upload with publishable key refused:", !!direct.error);
  await s.storage.from(ATTACHMENT_BUCKET).remove([path, path2]);
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
