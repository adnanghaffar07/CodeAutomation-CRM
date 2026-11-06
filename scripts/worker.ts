// Background worker: takes queued jobs from the Job table and runs them. Start with `npm run worker`.
// Safe to run several copies: each job is claimed with FOR UPDATE SKIP LOCKED. Stop with Ctrl+C.
import { loadEnv } from "./_env";

loadEnv();

const IDLE_MS = 3000;
const MAX_ATTEMPTS = 3;

async function main() {
  const { claimJob, finishJob, runImportBatch } = await import("../src/lib/imports-run");
  const { withSystem } = await import("../src/lib/scope");
  console.log("Worker started. Waiting for jobs (Ctrl+C to stop).");

  for (;;) {
    const job = await claimJob();
    if (!job) {
      await new Promise((r) => setTimeout(r, IDLE_MS));
      continue;
    }
    console.log(`[${new Date().toISOString()}] job ${job.id} (${job.kind}) started`);
    try {
      if (job.kind === "import") {
        await runImportBatch(String(job.payload.batchId));
      } else {
        throw new Error(`Unknown job kind: ${job.kind}`);
      }
      await finishJob(job.id);
      console.log(`job ${job.id} done`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`job ${job.id} failed: ${message}`);
      const attempts = await withSystem((tx) => tx.job.findUnique({ where: { id: job.id }, select: { attempts: true } }));
      if ((attempts?.attempts ?? 0) < MAX_ATTEMPTS) {
        // Try again later; a failed import page can be re-run because rows are only marked after they are applied.
        await withSystem((tx) => tx.job.update({ where: { id: job.id }, data: { status: "queued", lastError: message.slice(0, 500), runAt: new Date(Date.now() + 30_000) } }));
      } else {
        await finishJob(job.id, message);
        if (job.kind === "import" && job.payload.batchId) {
          await withSystem((tx) => tx.importBatch.update({ where: { id: String(job.payload.batchId) }, data: { status: "failed", finishedAt: new Date() } }));
        }
      }
    }
  }
}

main().catch((e) => {
  console.error("worker stopped:", String(e?.message ?? e).replace(/:\/\/([^:]+):[^@]+@/g, "://$1:<hidden>@"));
  process.exit(1);
});
