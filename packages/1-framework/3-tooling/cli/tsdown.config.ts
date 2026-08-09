import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: [
    'src/cli.ts',
    'src/exports/index.ts',
    'src/exports/config-types.ts',
    'src/exports/init-output.ts',
    'src/commands/contract-infer.ts',
    'src/commands/db-init.ts',
    'src/commands/db-schema.ts',
    'src/commands/db-update.ts',
    'src/commands/db-sign.ts',
    'src/commands/db-verify.ts',
    'src/commands/contract-emit.ts',
    'src/commands/migrate.ts',
    'src/commands/migration-new.ts',
    'src/commands/migration-plan.ts',
    'src/commands/ref.ts',
    'src/commands/telemetry/index.ts',
    'src/commands/migration-show.ts',
    'src/commands/migration-status.ts',
    'src/commands/migration-log.ts',
    'src/commands/migration-list.ts',
    'src/commands/migration-graph.ts',
    'src/commands/migration-check.ts',
    'src/migration-cli.ts',
    'src/exports/control-api.ts',
    'src/exports/control-api-testing.ts',
  ],
  copy: [{ from: 'src/commands/init/templates/*.md' }],
  // Keep manual exports to preserve stable CLI public subpaths.
  exports: { enabled: false },
  outputOptions: (opts) => ({
    ...opts,
    banner: (chunk) => (chunk.name === 'cli' ? '#!/usr/bin/env node\n' : ''),
  }),
});
