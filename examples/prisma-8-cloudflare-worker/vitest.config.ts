import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
import {
  CLOUDFLARE_HYPERDRIVE_VAR,
  EXAMPLE_ROOT,
  HYPERDRIVE_VAR,
  loadLocalEnv,
} from './scripts/env';

loadLocalEnv(EXAMPLE_ROOT);

// vitest-pool-workers' parseCustomPoolOptions calls wrangler's
// `unstable_getMiniflareWorkerOptions` BEFORE the `cloudflareTest` callback
// runs, so wrangler must already see the Hyperdrive env var when the config
// is parsed. Mirror WRANGLER_* into CLOUDFLARE_* (wrangler 4.87 deprecated
// the WRANGLER_* prefix). Soft-fail when neither is set: globalSetup throws
// the actionable error (`pnpm db:up && cp .env.example .env`); throwing
// here would crash any tooling that imports the config (e.g. `vitest list`,
// IDE integrations, `pnpm test:examples` filter passes that don't actually
// need the binding).
const databaseUrl = process.env[HYPERDRIVE_VAR] ?? process.env[CLOUDFLARE_HYPERDRIVE_VAR];
if (databaseUrl) {
  process.env[CLOUDFLARE_HYPERDRIVE_VAR] ??= databaseUrl;
}

export default defineConfig({
  plugins: [
    cloudflareTest(({ inject }) => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        compatibilityFlags: ['nodejs_compat'],
        compatibilityDate: '2025-07-18',
        hyperdrives: {
          HYPERDRIVE: inject('database-url'),
        },
      },
    })),
  ],
  test: {
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Pre-bundle pg and friends so vitest-pool-workers' module-fallback server
    // (which currently mis-resolves dual ESM/CJS exports under Vite 8 — see
    // cloudflare/workers-sdk#12984 and #13037) doesn't see them as bare
    // node_modules at workerd-load time.
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['pg'],
          rolldownOptions: {
            external: [
              'net',
              'events',
              'util',
              'util/types',
              'tls',
              'path',
              'fs',
              'dns',
              'crypto',
              'stream',
              'string_decoder',
              'os',
              'buffer',
              'url',
            ],
          },
        },
      },
    },
  },
});
