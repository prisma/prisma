import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: [
    'src/bin.ts',
    'src/exports/index.ts',
    'src/exports/config-types.ts',
    'src/exports/init-output.ts',
    'src/migration-cli.ts',
    'src/exports/control-api.ts',
    'src/exports/control-api-testing.ts',
  ],
  copy: [{ from: 'src/commands/init/templates/*.md' }],
  // Keep manual exports to preserve stable CLI public subpaths.
  exports: { enabled: false },
});
