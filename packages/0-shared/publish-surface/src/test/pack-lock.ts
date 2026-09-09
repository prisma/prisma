import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PACK_LOCK_STALE_MS = 120_000;
const PACK_LOCK_POLL_MS = 50;

/** Block the current thread for `ms` without spinning the CPU. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Serialise `pnpm pack` of one package across the whole test run.
 *
 * Packing a facade package fires its `prepack` (`scripts/sync-package-skills.ts`),
 * which rewrites that package's gitignored `skills/` tree. Tarball suites in
 * separate vitest projects pack the same package at once, so without this lock
 * one pack's tar phase can read the tree while another's prepack is mid-rewrite.
 * The sync script assumes a single writer per package (true of any real
 * publish, where each package is packed once); the concurrency the tests
 * manufacture is serialised here, keyed by package so unrelated packages still
 * pack in parallel. The lock is a directory in the OS temp dir, so it holds
 * across the separate processes vitest forks per project.
 *
 * This lives in `publish-surface` rather than the shell-testkit that uses it so
 * both writers (the tarball suites via shell-testkit, and this package's own
 * `package-skills` suite) can share one lock without a build cycle.
 */
export function withPackLock<T>(packageName: string, run: () => T): T {
  const slug = packageName.replaceAll(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const lockDir = join(tmpdir(), `prisma-pack-lock-${slug}`);
  const deadline = Date.now() + PACK_LOCK_STALE_MS;
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // Reclaim a lock a crashed run left behind.
      let heldSince = Date.now();
      try {
        heldSince = statSync(lockDir).mtimeMs;
      } catch {
        continue;
      }
      if (Date.now() - heldSince > PACK_LOCK_STALE_MS) {
        rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error(`timed out waiting to pack ${packageName}`);
      sleepSync(PACK_LOCK_POLL_MS);
    }
  }
  try {
    return run();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}
