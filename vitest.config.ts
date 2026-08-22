import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { composeCoverageConfig } from './scripts/coverage-config';

const coveragePolicy = composeCoverageConfig(import.meta.dirname);

export default defineConfig({
  test: {
    projects: ['packages/**/vitest.config.ts'],
    // Reuse all CI runner cores while keeping a fresh VM context per test file.
    // Stateful projects can override this default, as the Supabase suite does.
    maxWorkers: process.env['CI'] ? '100%' : undefined,
    pool: process.env['CI'] ? 'vmThreads' : undefined,
    experimental: {
      importDurations: {
        print: process.env['CI'] ? true : false,
        limit: 20,
      },
    },
    // Hard-suppress telemetry across every package test suite. The CLI's
    // `program.hook('preAction', …)` would otherwise fork the sender
    // child every time a test invokes the CLI in-process.
    // `PRISMA_NEXT_DISABLE_TELEMETRY=1` is the documented opt-out the CLI
    // honours in production; reusing it in test env keeps a single source
    // of truth instead of adding a test-only env var.
    env: {
      PRISMA_NEXT_DISABLE_TELEMETRY: '1',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: resolve(import.meta.dirname, 'coverage'),
      reporter: ['text', 'json'],
      reportOnFailure: true,
      ...coveragePolicy,
    },
  },
});
