import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';

/**
 * Vitest setup file for CLI package unit tests.
 *
 * Simulates an interactive terminal by setting `process.stdout.isTTY = true`.
 * Without this, vitest's forked worker process has piped stdout (isTTY is undefined),
 * which would trigger auto-JSON detection in `parseGlobalFlags()` and change the
 * behavior of unit tests that call it directly (without `setupCommandMocks`).
 *
 * Integration/journey tests use `setupCommandMocks()` which handles this independently.
 *
 * Also sandboxes `$XDG_CONFIG_HOME` to a per-worker tempdir so any test
 * that ends up calling `writeUserConfig` (e.g. the `init` consent
 * prompt path under a mocked `clack.confirm`) writes to a throwaway
 * directory instead of the developer's real user-level config file.
 */
process.stdout.isTTY = true;

if (process.env['XDG_CONFIG_HOME'] === undefined) {
  process.env['XDG_CONFIG_HOME'] = mkdtempSync(join(tmpdir(), 'prisma-8-cli-test-xdg-'));
}
